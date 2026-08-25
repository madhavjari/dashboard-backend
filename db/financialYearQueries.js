const { prisma } = require("../lib/prisma");
const { createCompanyWhere } = require("./reportScope");

function sortFinancialYears(financialYears) {
  return [...financialYears].sort((left, right) => {
    const leftStart = Number(left.split("-")[0]);
    const rightStart = Number(right.split("-")[0]);
    return leftStart - rightStart;
  });
}

async function findAvailableFinancialYears(reportContext) {
  const companyWhere = createCompanyWhere(reportContext);
  const [billYears, voucherYears] = await Promise.all([
    prisma.billEntry.findMany({
      where: companyWhere,
      distinct: ["financialYear"],
      select: { financialYear: true },
    }),
    prisma.paymentVoucher.findMany({
      where: companyWhere,
      distinct: ["financialYear"],
      select: { financialYear: true },
    }),
  ]);

  const financialYears = new Set(
    [...billYears, ...voucherYears].map((row) => row.financialYear),
  );

  return sortFinancialYears(financialYears);
}

module.exports = { findAvailableFinancialYears };
