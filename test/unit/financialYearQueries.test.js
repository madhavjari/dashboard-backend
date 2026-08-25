jest.mock("../../lib/prisma", () => ({
  prisma: {
    billEntry: { findMany: jest.fn() },
    paymentVoucher: { findMany: jest.fn() },
  },
}));

const { prisma } = require("../../lib/prisma");
const {
  findAvailableFinancialYears,
} = require("../../db/financialYearQueries");

describe("findAvailableFinancialYears", () => {
  beforeEach(() => jest.clearAllMocks());

  test("combines, deduplicates, and sorts bill and voucher years", async () => {
    prisma.billEntry.findMany.mockResolvedValue([
      { financialYear: "2026-2027" },
      { financialYear: "2025-2026" },
    ]);
    prisma.paymentVoucher.findMany.mockResolvedValue([
      { financialYear: "2025-2026" },
    ]);

    await expect(
      findAvailableFinancialYears({
        mode: "authenticated",
        companyIds: ["company-1"],
      }),
    ).resolves.toEqual(["2025-2026", "2026-2027"]);

    expect(prisma.billEntry.findMany).toHaveBeenCalledWith({
      where: { companyId: "company-1" },
      distinct: ["financialYear"],
      select: { financialYear: true },
    });
  });
});
