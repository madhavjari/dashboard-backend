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
  return prisma.accountingCompany.findMany({
    where: createCompanyWhere(reportContext),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      company: { select: { name: true } },
    },
  });
}

module.exports = {
  findAvailableAccountingCompanies,
  findAvailableFinancialYears,
};
