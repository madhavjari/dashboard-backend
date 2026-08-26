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
          accountingCompanyId: { in: ["books-1", "books-2"] },
          financialYear: "2026-2027",
          code: { in: ["S", "SR"] },
        },
      }),
    );
    expect(
      prisma.billEntry.findMany.mock.calls[0][0].where,
    ).not.toHaveProperty("isOpening");
  });

  test("uses only allocations from the selected financial year", async () => {
    await findPaymentAllocations(
      {
        mode: "authenticated",
        companyIds: ["company-1"],
        accountingCompanyIds: ["books-1"],
      },
      "BR",
      ["S-1"],
      "2026-2027",
    );

    expect(prisma.paymentAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentVoucher: {
            financialYear: "2026-2027",
            accountingCompanyId: "books-1",
          },
        }),
      }),
    );
  });
});
