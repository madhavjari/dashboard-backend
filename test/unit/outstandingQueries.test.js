jest.mock("../../lib/prisma.js", () => ({
  prisma: {
    billEntry: { findMany: jest.fn() },
    paymentAllocation: { findMany: jest.fn() },
  },
}));

const { prisma } = require("../../lib/prisma.js");
const {
  findBillEntries,
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
          code: { in: ["S", "SR"] },
          OR: [
            {
              financialYear: "2026-2027",
              accountingCompanyId: { in: ["books-1", "books-2"] },
            },
            {
              financialYear: { gt: "2026-2027" },
              isOpening: true,
            },
          ],
        },
      }),
    );
  });

  test("returns distinct item names for each invoice", async () => {
    prisma.billEntry.findMany.mockResolvedValue([
      {
        accountingCompanyId: "books-1",
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

  test("keeps selected-year openings but excludes carried copies from later years", async () => {
    await findPaymentAllocations(
      {
        mode: "authenticated",
        companyIds: ["company-1"],
        accountingCompanyIds: ["books-1"],
      },
      "BR",
      ["100"],
      ["S-1"],
      "2026-2027",
    );

    expect(prisma.paymentAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { billEntrySourceId: { in: ["100"] } },
            { billEntrySourceId: null, billNo: { in: ["S-1"] } },
          ],
          paymentVoucher: {
            financialYear: { gte: "2026-2027" },
            OR: [
              { financialYear: "2026-2027" },
              { isOpening: false },
            ],
          },
        }),
      }),
    );
  });
});
