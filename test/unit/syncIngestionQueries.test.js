jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

const { prisma } = require("../../lib/prisma");
const {
  ingestBills,
  ingestPaymentVouchers,
} = require("../../db/syncIngestionQueries");

let tx;

beforeEach(() => {
  jest.clearAllMocks();
  tx = {
    accountingCompany: { findMany: jest.fn() },
    billEntry: { upsert: jest.fn() },
    billItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    paymentVoucher: { upsert: jest.fn() },
    paymentAllocation: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    syncSource: { update: jest.fn() },
  };
  prisma.$transaction.mockImplementation((callback) => callback(tx));
});

describe("ingestBills", () => {
  const bills = [
    {
      financialYear: "2026-2027",
      isOpening: true,
      entryId: "100",
      compNo: "1",
      code: "S",
      book: "SALES",
      billNo: "S-100",
      date: new Date("2026-08-20T00:00:00.000Z"),
      party: "ABC CUSTOMER",
      partyCode: "ABC",
      agent: null,
      grossAmount: "1180.00",
      netAmount: "1180.00",
      cgst: 90,
      sgst: 90,
      igst: 0,
      entryDate: new Date("2026-08-19T12:00:00.000Z"),
      modifyDate: new Date("2026-08-20T12:00:00.000Z"),
      modifyTime: "12:00",
      items: [
        {
          entryId: "1",
          serial: "1",
          itemCode: "ITEM-1",
          itemName: "Fabric",
          category: "Goods",
          group: "Textiles",
          quantity: 10,
          rate: 100,
          discount: 5,
          taxable: 1000,
          finalAmount: 1180,
        },
      ],
    },
  ];

  it("rejects unknown CompNo values without writing any records", async () => {
    tx.accountingCompany.findMany.mockResolvedValue([
      { id: "books_1", externalId: "1" },
    ]);

    const result = await ingestBills({
      companyId: "account_1",
      syncSourceId: "source_1",
      bills: [
        ...bills,
        { ...bills[0], entryId: "200", compNo: "7" },
      ],
    });

    expect(result).toEqual({
      status: "unknown_companies",
      unknownExternalCompanyIds: ["7"],
    });
    expect(tx.accountingCompany.findMany).toHaveBeenCalledWith({
      where: {
        companyId: "account_1",
        syncSourceId: "source_1",
        externalId: { in: ["1", "7"] },
      },
      select: { id: true, externalId: true },
    });
    expect(tx.billEntry.upsert).not.toHaveBeenCalled();
    expect(tx.syncSource.update).not.toHaveBeenCalled();
  });

  it("upserts a tenant-scoped bill and replaces its item snapshot", async () => {
    tx.accountingCompany.findMany.mockResolvedValue([
      { id: "books_1", externalId: "1" },
    ]);
    tx.billEntry.upsert.mockResolvedValue({ id: 11n });
    tx.billItem.deleteMany.mockResolvedValue({ count: 1 });
    tx.billItem.createMany.mockResolvedValue({ count: 1 });
    tx.syncSource.update.mockResolvedValue({ id: "source_1" });

    const result = await ingestBills({
      companyId: "account_1",
      syncSourceId: "source_1",
      bills,
    });

    expect(result).toEqual({
      status: "ok",
      count: 1,
      accountingCompanyCount: 1,
    });
    expect(tx.billEntry.upsert).toHaveBeenCalledWith({
      where: {
        companyId_syncSourceId_financialYear_compNo_entryId: {
          companyId: "account_1",
          syncSourceId: "source_1",
          financialYear: "2026-2027",
          compNo: "1",
          entryId: "100",
        },
      },
      create: expect.objectContaining({
        companyId: "account_1",
        syncSourceId: "source_1",
        accountingCompanyId: "books_1",
        financialYear: "2026-2027",
        isOpening: true,
        compNo: "1",
        entryId: "100",
        billDate: new Date("2026-08-20T00:00:00.000Z"),
      }),
      update: expect.objectContaining({
        accountingCompanyId: "books_1",
        netAmount: "1180.00",
      }),
      select: { id: true },
    });
    expect(tx.billItem.deleteMany).toHaveBeenCalledWith({
      where: {
        companyId: "account_1",
        billEntryId: 11n,
      },
    });
    expect(tx.billItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companyId: "account_1",
          billEntryId: 11n,
          entryId: "1",
          itemGroup: "Textiles",
          discountAmount: 5,
          taxableAmount: 1000,
        }),
      ],
    });
    expect(tx.billItem.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.billItem.createMany.mock.invocationCallOrder[0],
    );
    expect(tx.syncSource.update).toHaveBeenCalledWith({
      where: {
        companyId_id: {
          companyId: "account_1",
          id: "source_1",
        },
      },
      data: { lastSyncedAt: expect.any(Date) },
    });
  });

  it("removes stale items when the latest snapshot has none", async () => {
    tx.accountingCompany.findMany.mockResolvedValue([
      { id: "books_1", externalId: "1" },
    ]);
    tx.billEntry.upsert.mockResolvedValue({ id: 11n });

    await ingestBills({
      companyId: "account_1",
      syncSourceId: "source_1",
      bills: [{ ...bills[0], items: [] }],
    });

    expect(tx.billItem.deleteMany).toHaveBeenCalled();
    expect(tx.billItem.createMany).not.toHaveBeenCalled();
  });
});

describe("ingestPaymentVouchers", () => {
  const vouchers = [
    {
      financialYear: "2026-2027",
      isOpening: false,
      entryId: "200",
      compNo: "2",
      date: new Date("2026-08-20T00:00:00.000Z"),
      mode: "BR",
      vchrType: "Receipt",
      slipNo: "SLIP-1",
      refNo: "REF-1",
      party: "ABC CUSTOMER",
      chequeNo: null,
      chequeDate: null,
      chequeBank: null,
      clearingDate: null,
      netAmount: "500.00",
      remarks: "Part payment",
      modifyDate: new Date("2026-08-20T12:00:00.000Z"),
      modifyTime: "12:00",
      items: [
        {
          entryId: "1",
          code: "BR",
          billEntrySourceId: "9876",
          billNo: "S-100",
          date: new Date("2026-08-20T00:00:00.000Z"),
          mode: "Against Ref",
          billAmt: "1180.00",
          adjustAmt: "500.00",
          unAdjAmt: "0.00",
          bAlAmt: "680.00",
          status: "PARTIAL",
        },
      ],
    },
  ];

  it("upserts a voucher and replaces its allocation snapshot", async () => {
    tx.accountingCompany.findMany.mockResolvedValue([
      { id: "books_2", externalId: "2" },
    ]);
    tx.paymentVoucher.upsert.mockResolvedValue({ id: 22n });
    tx.paymentAllocation.deleteMany.mockResolvedValue({ count: 1 });
    tx.paymentAllocation.createMany.mockResolvedValue({ count: 1 });

    const result = await ingestPaymentVouchers({
      companyId: "account_1",
      syncSourceId: "source_1",
      vouchers,
    });

    expect(result).toEqual({
      status: "ok",
      count: 1,
      accountingCompanyCount: 1,
    });
    expect(tx.paymentVoucher.upsert).toHaveBeenCalledWith({
      where: {
        companyId_syncSourceId_financialYear_compNo_entryId: {
          companyId: "account_1",
          syncSourceId: "source_1",
          financialYear: "2026-2027",
          compNo: "2",
          entryId: "200",
        },
      },
      create: expect.objectContaining({
        companyId: "account_1",
        syncSourceId: "source_1",
        accountingCompanyId: "books_2",
        financialYear: "2026-2027",
        isOpening: false,
        voucherType: "Receipt",
        referenceNo: "REF-1",
      }),
      update: expect.objectContaining({
        accountingCompanyId: "books_2",
        netAmount: "500.00",
      }),
      select: { id: true },
    });
    expect(tx.paymentAllocation.deleteMany).toHaveBeenCalledWith({
      where: {
        companyId: "account_1",
        paymentVoucherId: 22n,
      },
    });
    expect(tx.paymentAllocation.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companyId: "account_1",
          paymentVoucherId: 22n,
          entryId: "1",
          billEntrySourceId: "9876",
          billNo: "S-100",
          adjustedAmount: "500.00",
          balanceAmount: "680.00",
        }),
      ],
    });
  });

  it("rejects a voucher for a different computer's company", async () => {
    tx.accountingCompany.findMany.mockResolvedValue([]);

    const result = await ingestPaymentVouchers({
      companyId: "account_1",
      syncSourceId: "source_1",
      vouchers,
    });

    expect(result).toEqual({
      status: "unknown_companies",
      unknownExternalCompanyIds: ["2"],
    });
    expect(tx.paymentVoucher.upsert).not.toHaveBeenCalled();
  });
});
