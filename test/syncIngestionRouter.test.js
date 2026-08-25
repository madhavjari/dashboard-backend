const request = require("supertest");

jest.mock("../db/syncSourceQueries", () => ({
  authenticateSyncApiKey: jest.fn(),
  getCompanySyncStatus: jest.fn(),
  provisionSyncSource: jest.fn(),
}));
jest.mock("../db/syncIngestionQueries", () => ({
  ingestBills: jest.fn(),
  ingestPaymentVouchers: jest.fn(),
}));

const { authenticateSyncApiKey } = require("../db/syncSourceQueries");
const {
  ingestBills,
  ingestPaymentVouchers,
} = require("../db/syncIngestionQueries");
const app = require("../app");

const syncAuth = {
  apiKeyId: "key_1",
  companyId: "account_1",
  syncSourceId: "source_1",
};

const validBill = {
  financialYear: "2026-2027",
  isOpening: false,
  entryId: 100,
  compNo: 1,
  code: "S",
  billNo: "S-100",
  date: "2026-08-20T00:00:00.000Z",
  party: "ABC CUSTOMER",
  grossAmount: "1180.00",
  netAmount: 1180,
  cgst: 90,
  sgst: 90,
  igst: 0,
  items: [
    {
      serial: "1",
      itemCode: "ITEM-1",
      itemName: "Fabric",
      group: "Textiles",
      quantity: 10,
      rate: 100,
      amount: 1000,
      taxable: 1000,
      finalAmount: 1180,
    },
  ],
};

const validVoucher = {
  financialYear: "2026-2027",
  isOpening: true,
  entryId: 200,
  compNo: 1,
  date: "2026-08-20T00:00:00.000Z",
  mode: "BR",
  vchrType: "Receipt",
  party: "ABC CUSTOMER",
  netAmount: "500.00",
  items: [
    {
      entryId: 1,
      code: "BR",
      billNo: "S-100",
      date: "2026-08-20T00:00:00.000Z",
      adjustAmt: 500,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  authenticateSyncApiKey.mockResolvedValue(syncAuth);
});

describe("POST /api/v1/sync/bills", () => {
  it("requires a valid computer API key", async () => {
    const response = await request(app)
      .post("/api/v1/sync/bills")
      .send([validBill]);

    expect(response.status).toBe(401);
    expect(ingestBills).not.toHaveBeenCalled();
  });

  it("validates the batch before writing", async () => {
    const response = await request(app)
      .post("/api/v1/sync/bills")
      .set("Authorization", "Bearer sync_abc.secret")
      .send([{ ...validBill, compNo: undefined }]);

    expect(response.status).toBe(400);
    expect(response.body.errors["0.compNo"]).toBeDefined();
    expect(ingestBills).not.toHaveBeenCalled();
  });

  it("rejects duplicate bill identities within one company", async () => {
    const response = await request(app)
      .post("/api/v1/sync/bills")
      .set("Authorization", "Bearer sync_abc.secret")
      .send([validBill, { ...validBill }]);

    expect(response.status).toBe(400);
    expect(response.body.errors["1.entryId"]).toEqual([
      "Duplicate bill for this company number",
    ]);
    expect(ingestBills).not.toHaveBeenCalled();
  });

  it("uses the trusted computer context and normalizes source IDs", async () => {
    ingestBills.mockResolvedValue({
      status: "ok",
      count: 2,
      accountingCompanyCount: 2,
    });

    const response = await request(app)
      .post("/api/v1/sync/bills")
      .set("Authorization", "Bearer sync_abc.secret")
      .send([validBill, { ...validBill, entryId: 101, compNo: 2 }]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Synchronized 2 bill(s).",
      count: 2,
      accountingCompanyCount: 2,
    });
    expect(ingestBills).toHaveBeenCalledWith({
      companyId: "account_1",
      syncSourceId: "source_1",
      bills: [
        expect.objectContaining({
          financialYear: "2026-2027",
          isOpening: false,
          entryId: "100",
          compNo: "1",
          date: new Date("2026-08-20T00:00:00.000Z"),
        }),
        expect.objectContaining({
          entryId: "101",
          compNo: "2",
        }),
      ],
    });
  });

  it("accepts the same source identity in different financial years", async () => {
    ingestBills.mockResolvedValue({
      status: "ok",
      count: 2,
      accountingCompanyCount: 1,
    });

    const response = await request(app)
      .post("/api/v1/sync/bills")
      .set("Authorization", "Bearer sync_abc.secret")
      .send([
        validBill,
        { ...validBill, financialYear: "2025-2026" },
      ]);

    expect(response.status).toBe(200);
    expect(ingestBills).toHaveBeenCalledWith(
      expect.objectContaining({ bills: expect.arrayContaining([
        expect.objectContaining({ financialYear: "2025-2026" }),
        expect.objectContaining({ financialYear: "2026-2027" }),
      ]) }),
    );
  });

  it("rejects an unregistered CompNo before accepting the upload", async () => {
    ingestBills.mockResolvedValue({
      status: "unknown_companies",
      unknownExternalCompanyIds: ["7"],
    });

    const response = await request(app)
      .post("/api/v1/sync/bills")
      .set("Authorization", "Bearer sync_abc.secret")
      .send([{ ...validBill, compNo: 7 }]);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      code: "ACCOUNTING_COMPANY_NOT_REGISTERED",
      message: "Register accounting companies before uploading records.",
      unknownExternalCompanyIds: ["7"],
    });
  });
});

describe("POST /api/v1/sync/vouchers", () => {
  it("validates and forwards payment vouchers using trusted context", async () => {
    ingestPaymentVouchers.mockResolvedValue({
      status: "ok",
      count: 1,
      accountingCompanyCount: 1,
    });

    const response = await request(app)
      .post("/api/v1/sync/vouchers")
      .set("Authorization", "Bearer sync_abc.secret")
      .send([validVoucher]);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(ingestPaymentVouchers).toHaveBeenCalledWith({
      companyId: "account_1",
      syncSourceId: "source_1",
      vouchers: [
        expect.objectContaining({
          financialYear: "2026-2027",
          isOpening: true,
          entryId: "200",
          compNo: "1",
          date: new Date("2026-08-20T00:00:00.000Z"),
          items: [
            expect.objectContaining({
              entryId: "1",
              adjustAmt: 500,
            }),
          ],
        }),
      ],
    });
  });

  it("rejects malformed numeric input", async () => {
    const response = await request(app)
      .post("/api/v1/sync/vouchers")
      .set("Authorization", "Bearer sync_abc.secret")
      .send([{ ...validVoucher, netAmount: "not-a-number" }]);

    expect(response.status).toBe(400);
    expect(response.body.errors["0.netAmount"]).toBeDefined();
    expect(ingestPaymentVouchers).not.toHaveBeenCalled();
  });

  it("reports every unregistered company number", async () => {
    ingestPaymentVouchers.mockResolvedValue({
      status: "unknown_companies",
      unknownExternalCompanyIds: ["3", "9"],
    });

    const response = await request(app)
      .post("/api/v1/sync/vouchers")
      .set("Authorization", "Bearer sync_abc.secret")
      .send([
        { ...validVoucher, compNo: 3 },
        { ...validVoucher, entryId: 201, compNo: 9 },
      ]);

    expect(response.status).toBe(422);
    expect(response.body.unknownExternalCompanyIds).toEqual(["3", "9"]);
  });
});
