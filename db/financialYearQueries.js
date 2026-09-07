const { prisma } = require("../lib/prisma");
const {
  createAccountingCompanyWhere,
  createCompanyWhere,
} = require("./reportScope");

function sortFinancialYears(financialYears) {
  return [...financialYears].sort((left, right) => {
    const leftStart = Number(left.split("-")[0]);
    const rightStart = Number(right.split("-")[0]);
    return leftStart - rightStart;
  });
}

function normalizeAccountingCompanyName(name) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase();
}

function groupAccountingCompanies(companies) {
  const groups = new Map();

  for (const company of companies) {
    const key = `${company.companyId}\u0000${normalizeAccountingCompanyName(
      company.name,
    )}`;
    const existing = groups.get(key);

    if (existing) {
      existing.accountingCompanyIds.push(company.id);
      continue;
    }

    groups.set(key, {
      id: company.id,
      name: company.name,
      company: company.company,
      accountingCompanyIds: [company.id],
    });
  }

  return [...groups.values()];
}

async function findAvailableFinancialYears(reportContext) {
  const companyWhere = createCompanyWhere(reportContext);
  const accountingCompanyWhere = createAccountingCompanyWhere(reportContext);
  const [billYears, voucherYears] = await Promise.all([
    prisma.billEntry.findMany({
      where: { ...companyWhere, ...accountingCompanyWhere },
      distinct: ["financialYear"],
      select: { financialYear: true },
    }),
    prisma.paymentVoucher.findMany({
      where: { ...companyWhere, ...accountingCompanyWhere },
      distinct: ["financialYear"],
      select: { financialYear: true },
    }),
  ]);

  const financialYears = new Set(
    [...billYears, ...voucherYears].map((row) => row.financialYear),
  );

  return sortFinancialYears(financialYears);
}

async function findAvailableAccountingCompanies(reportContext) {
  const companies = await prisma.accountingCompany.findMany({
    where: createCompanyWhere(reportContext),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      companyId: true,
      name: true,
      company: { select: { name: true } },
    },
  });

  return groupAccountingCompanies(companies);
}

module.exports = {
  findAvailableAccountingCompanies,
  findAvailableFinancialYears,
};
