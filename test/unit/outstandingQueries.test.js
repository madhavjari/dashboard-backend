jest.mock("../../lib/prisma.js", () => ({
  prisma: {
    billEntry: { findMany: jest.fn() },
    paymentAllocation: { findMany: jest.fn() },
  },
}));

const { prisma } = require("../../lib/prisma.js");
const {
  findBillEntries,
  findRelatedBillEntries,
  findPaymentAllocations,
} = require("../../db/outstandingQueries");

describe("outstanding financial-year queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.billEntry.findMany.mockResolvedValue([]);
    prisma.paymentAllocation.findMany.mockResolvedValue([]);
  });

  test("keeps opening bills in the selected financial year", async () => {
    await findBillEntries(
      {
        mode: "authenticated",
        companyIds: ["company-1"],
        accountingCompanyIds: ["books-1", "books-2"],
      },
      ["S", "SR"],
      "2026-2027",
    );

    expect(prisma.billEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          accountingCompanyId: { in: ["books-1", "books-2"] },
          financialYear: "2026-2027",
          code: { in: ["S", "SR"] },
        },
      }),
    );
  });

  test("loads related return-bearing bill representations in one tenant-scoped query", async () => {
    await findRelatedBillEntries(
      {
        mode: "authenticated",
        companyIds: ["company-1"],
        accountingCompanyIds: ["books-1"],
      },
      ["S"],
      "2026-2027",
      ["100", "101", "100"],
      ["S-1", "S-2", "S-1"],
    );

    expect(prisma.billEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          financialYear: { not: "2026-2027" },
          code: { in: ["S"] },
          entryId: { in: ["100", "101"] },
          billNo: { in: ["S-1", "S-2"] },
          returnAdjustments: { some: {} },
        },
        select: expect.not.objectContaining({ items: expect.anything() }),
      }),
    );
  });

  test("returns distinct item names for each invoice", async () => {
    prisma.billEntry.findMany.mockResolvedValue([
      {
        companyId: "company-1",
        accountingCompanyId: "books-1",
        accountingCompany: {
          syncSourceId: "source-1",
          name: "Madhav Enterprise",
        },
        code: "S",
        billNo: "S-1",
        billDate: new Date("2026-04-01"),
        party: "ACME",
        netAmount: "1200.00",
        items: [
          { itemName: "COTTON" },
          { itemName: "COTTON" },
          { itemName: "LINEN" },
          { itemName: null },
        ],
      },
    ]);

    await expect(
      findBillEntries(
        { mode: "authenticated", companyIds: ["company-1"] },
        ["S"],
        "2026-2027",
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        accounting_company_key:
          '["company-1","source-1","MADHAV ENTERPRISE"]',
        bill_no: "S-1",
        item_names: ["COTTON", "LINEN"],
      }),
    ]);
    expect(prisma.billEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          items: {
            select: {
              itemName: true,
              pcs: true,
              meters: true,
              weight: true,
              per: true,
            },
          },
        }),
      }),
    );
  });

  test("loads matching allocation history in one tenant-scoped query", async () => {
    await findPaymentAllocations(
      {
        mode: "authenticated",
        companyIds: ["company-1"],
        accountingCompanyIds: ["books-1"],
      },
      "BR",
      ["100"],
      ["S-1"],
    );

    expect(prisma.paymentAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { billEntrySourceId: { in: ["100"] } },
            { billEntrySourceId: null, billNo: { in: ["S-1"] } },
          ],
        }),
        select: expect.objectContaining({
          allocationDate: true,
          paymentVoucher: {
            select: expect.objectContaining({
              financialYear: true,
              isOpening: true,
              voucherDate: true,
            }),
          },
        }),
      }),
    );
  });
});
