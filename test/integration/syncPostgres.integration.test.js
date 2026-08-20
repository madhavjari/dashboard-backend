const crypto = require("node:crypto");
const request = require("supertest");

const app = require("../../app");
const { prisma } = require("../../lib/prisma");
const { generateSyncApiKey } = require("../../utils/syncApiKey");

const describePostgres =
  process.env.RUN_POSTGRES_INTEGRATION === "1" ? describe : describe.skip;

describePostgres("PostgreSQL accounting sync integration", () => {
  jest.setTimeout(60_000);

  const suffix = crypto.randomUUID().slice(0, 8);
  const billEntryIdOne = `integration-bill-1-${suffix}`;
  const billEntryIdTwo = `integration-bill-2-${suffix}`;
  const voucherEntryId = `integration-voucher-1-${suffix}`;

  let companyId;
  let syncSourceId;
  let apiKey;

  function authenticatedPost(path) {
    return request(app)
      .post(path)
      .set("Authorization", `Bearer ${apiKey}`);
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        name: `Integration Account ${suffix}`,
      },
      select: { id: true },
    });
    companyId = company.id;

    const syncSource = await prisma.syncSource.create({
      data: {
        companyId,
        name: `Integration Computer ${suffix}`,
      },
      select: { id: true },
    });
    syncSourceId = syncSource.id;

    const generatedKey = generateSyncApiKey();
    apiKey = generatedKey.apiKey;
    await prisma.syncApiKey.create({
      data: {
        companyId,
        syncSourceId,
        name: "Integration test key",
        keyPrefix: generatedKey.keyPrefix,
        keyHash: generatedKey.keyHash,
      },
    });

    const response = await authenticatedPost("/api/v1/sync/companies").send({
      companies: [
        { externalCompanyId: "1", name: "Integration Books One" },
        { externalCompanyId: "2", name: "Integration Books Two" },
      ],
    });

    if (response.status !== 200) {
      throw new Error(
        `Accounting-company setup failed with ${response.status}: ${JSON.stringify(response.body)}`,
      );
    }
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.company.deleteMany({
        where: { id: companyId },
      });
    }
    await prisma.$disconnect();
  });

  it("registers both CompNo values under the authenticated computer", async () => {
    const companies = await prisma.accountingCompany.findMany({
      where: {
        companyId,
        syncSourceId,
      },
      orderBy: { externalId: "asc" },
      select: {
        externalId: true,
        name: true,
      },
    });

    expect(companies).toEqual([
      {
        externalId: "1",
        name: "Integration Books One",
      },
      {
        externalId: "2",
        name: "Integration Books Two",
      },
    ]);
  });

  it("persists bills for multiple accounting companies and replaces item snapshots", async () => {
    const firstResponse = await authenticatedPost("/api/v1/sync/bills").send([
      {
        entryId: billEntryIdOne,
        compNo: 1,
        code: "S",
        billNo: "INT-S-1",
        date: "2026-08-20T00:00:00.000Z",
        party: "INTEGRATION CUSTOMER",
        grossAmount: "1180.00",
        netAmount: "1180.00",
        cgst: "90.00",
        sgst: "90.00",
        items: [
          {
            entryId: 1,
            serial: "1",
            itemCode: "INT-ITEM-1",
            itemName: "Integration Fabric",
            quantity: "10.000",
            rate: "100.00",
            amount: "1000.00",
            taxable: "1000.00",
            finalAmount: "1180.00",
          },
          {
            entryId: 2,
            serial: "2",
            itemCode: "INT-ITEM-2",
            itemName: "Item removed by repeat sync",
            quantity: 1,
          },
        ],
      },
      {
        entryId: billEntryIdTwo,
        compNo: 2,
        code: "P",
        billNo: "INT-P-1",
        date: "2026-08-20T00:00:00.000Z",
        party: "INTEGRATION SUPPLIER",
        netAmount: "500.00",
        items: [],
      },
    ]);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toEqual({
      success: true,
      message: "Synchronized 2 bill(s).",
      count: 2,
      accountingCompanyCount: 2,
    });

    const repeatResponse = await authenticatedPost("/api/v1/sync/bills").send([
      {
        entryId: billEntryIdOne,
        compNo: "1",
        code: "S",
        billNo: "INT-S-1-UPDATED",
        date: "2026-08-21T00:00:00.000Z",
        party: "INTEGRATION CUSTOMER",
        netAmount: "1200.00",
        items: [
          {
            entryId: "1",
            serial: "1",
            itemCode: "INT-ITEM-1",
            itemName: "Integration Fabric Updated",
            quantity: "12.000",
            finalAmount: "1200.00",
          },
        ],
      },
    ]);

    expect(repeatResponse.status).toBe(200);

    const storedBills = await prisma.billEntry.findMany({
      where: { companyId },
      orderBy: { entryId: "asc" },
      include: {
        accountingCompany: {
          select: { externalId: true },
        },
        items: {
          orderBy: { entryId: "asc" },
        },
      },
    });

    expect(storedBills).toHaveLength(2);
    const firstBill = storedBills.find(
      (bill) => bill.entryId === billEntryIdOne,
    );
    const secondBill = storedBills.find(
      (bill) => bill.entryId === billEntryIdTwo,
    );

    expect(firstBill.accountingCompany.externalId).toBe("1");
    expect(firstBill.billNo).toBe("INT-S-1-UPDATED");
    expect(firstBill.netAmount.toString()).toBe("1200");
    expect(firstBill.items).toHaveLength(1);
    expect(firstBill.items[0].itemName).toBe(
      "Integration Fabric Updated",
    );
    expect(secondBill.accountingCompany.externalId).toBe("2");
  });

  it("persists vouchers and replaces allocation snapshots", async () => {
    const firstResponse = await authenticatedPost(
      "/api/v1/sync/vouchers",
    ).send([
      {
        entryId: voucherEntryId,
        compNo: 1,
        date: "2026-08-22T00:00:00.000Z",
        mode: "BR",
        vchrType: "Receipt",
        party: "INTEGRATION CUSTOMER",
        netAmount: "700.00",
        items: [
          {
            entryId: 1,
            code: "BR",
            billNo: "INT-S-1-UPDATED",
            date: "2026-08-22T00:00:00.000Z",
            billAmt: "1200.00",
            adjustAmt: "700.00",
            bAlAmt: "500.00",
          },
          {
            entryId: 2,
            code: "BR",
            billNo: "REMOVED-ALLOCATION",
            adjustAmt: "1.00",
          },
        ],
      },
    ]);

    expect(firstResponse.status).toBe(200);

    const repeatResponse = await authenticatedPost(
      "/api/v1/sync/vouchers",
    ).send([
      {
        entryId: voucherEntryId,
        compNo: "1",
        date: "2026-08-23T00:00:00.000Z",
        mode: "BR",
        vchrType: "Receipt",
        party: "INTEGRATION CUSTOMER",
        netAmount: "800.00",
        items: [
          {
            entryId: "1",
            code: "BR",
            billNo: "INT-S-1-UPDATED",
            date: "2026-08-23T00:00:00.000Z",
            billAmt: "1200.00",
            adjustAmt: "800.00",
            bAlAmt: "400.00",
          },
        ],
      },
    ]);

    expect(repeatResponse.status).toBe(200);

    const storedVoucher = await prisma.paymentVoucher.findFirstOrThrow({
      where: {
        companyId,
        syncSourceId,
        entryId: voucherEntryId,
      },
      include: {
        accountingCompany: {
          select: { externalId: true },
        },
        allocations: true,
      },
    });

    expect(storedVoucher.accountingCompany.externalId).toBe("1");
    expect(storedVoucher.netAmount.toString()).toBe("800");
    expect(storedVoucher.allocations).toHaveLength(1);
    expect(storedVoucher.allocations[0].adjustedAmount.toString()).toBe(
      "800",
    );
  });

  it("rejects an unknown CompNo without partially writing the known record", async () => {
    const rollbackEntryId = `integration-rollback-${suffix}`;
    const response = await authenticatedPost("/api/v1/sync/bills").send([
      {
        entryId: rollbackEntryId,
        compNo: "1",
        code: "S",
        billNo: "SHOULD-NOT-BE-STORED",
        items: [],
      },
      {
        entryId: `integration-unknown-${suffix}`,
        compNo: "99",
        code: "S",
        billNo: "UNKNOWN-COMPANY",
        items: [],
      },
    ]);

    expect(response.status).toBe(422);
    expect(response.body.unknownExternalCompanyIds).toEqual(["99"]);
    await expect(
      prisma.billEntry.count({
        where: {
          companyId,
          entryId: rollbackEntryId,
        },
      }),
    ).resolves.toBe(0);
  });

  it("updates the computer's synchronization timestamp", async () => {
    const source = await prisma.syncSource.findUniqueOrThrow({
      where: {
        companyId_id: {
          companyId,
          id: syncSourceId,
        },
      },
      select: { lastSyncedAt: true },
    });

    expect(source.lastSyncedAt).toBeInstanceOf(Date);
  });
});
