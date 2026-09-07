jest.mock("../../lib/prisma", () => ({
  prisma: {
    accountingCompany: { findMany: jest.fn() },
    billEntry: { findMany: jest.fn() },
    paymentVoucher: { findMany: jest.fn() },
  },
}));

const { prisma } = require("../../lib/prisma");
const {
  findAvailableAccountingCompanies,
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
        accountingCompanyIds: ["books-1", "books-2"],
      }),
    ).resolves.toEqual(["2025-2026", "2026-2027"]);

    expect(prisma.billEntry.findMany).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        accountingCompanyId: { in: ["books-1", "books-2"] },
      },
      distinct: ["financialYear"],
      select: { financialYear: true },
    });
  });

  test("lists accounting companies only from accessible customer accounts", async () => {
    const companies = [
      {
        id: "books-1",
        syncSourceId: "source-1",
        name: "North Division",
        company: { name: "Owner Workspace" },
      },
    ];
    prisma.accountingCompany.findMany.mockResolvedValue(companies);

    await expect(
      findAvailableAccountingCompanies({
        mode: "authenticated",
        companyIds: ["company-1", "company-2"],
      }),
    ).resolves.toEqual([
      {
        id: "books-1",
        name: "North Division",
        company: { name: "Owner Workspace" },
        accountingCompanyIds: ["books-1"],
      },
    ]);

    expect(prisma.accountingCompany.findMany).toHaveBeenCalledWith({
      where: { companyId: { in: ["company-1", "company-2"] } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        syncSourceId: true,
        name: true,
        company: { select: { name: true } },
      },
    });
  });

  test("groups financial-year companies with the same name from one source", async () => {
    prisma.accountingCompany.findMany.mockResolvedValue([
      {
        id: "books-1",
        syncSourceId: "source-1",
        name: " Madhav   Enterprise ",
        company: { name: "Owner Workspace" },
      },
      {
        id: "books-2",
        syncSourceId: "source-1",
        name: "MADHAV ENTERPRISE",
        company: { name: "Owner Workspace" },
      },
      {
        id: "books-3",
        syncSourceId: "source-2",
        name: "MADHAV ENTERPRISE",
        company: { name: "Owner Workspace" },
      },
    ]);

    await expect(
      findAvailableAccountingCompanies({
        mode: "authenticated",
        companyIds: ["company-1"],
      }),
    ).resolves.toEqual([
      {
        id: "books-1",
        name: " Madhav   Enterprise ",
        company: { name: "Owner Workspace" },
        accountingCompanyIds: ["books-1", "books-2"],
      },
      {
        id: "books-3",
        name: "MADHAV ENTERPRISE",
        company: { name: "Owner Workspace" },
        accountingCompanyIds: ["books-3"],
      },
    ]);
  });
});
