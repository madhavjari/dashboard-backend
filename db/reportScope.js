function getReportCompanyIds(reportContext) {
  if (reportContext?.mode === "demo") {
    return reportContext.companyId ? [reportContext.companyId] : [];
  }

  if (reportContext?.mode === "authenticated") {
    return [...new Set(reportContext.companyIds || [])].filter(Boolean);
  }

  return [];
}

function createCompanyWhere(reportContext) {
  const companyIds = getReportCompanyIds(reportContext);
  if (companyIds.length === 1) return { companyId: companyIds[0] };
  return { companyId: { in: companyIds } };
}

function getAccountingCompanyIds(reportContext) {
  return [...new Set(reportContext?.accountingCompanyIds || [])].filter(
    Boolean,
  );
}

function createAccountingCompanyWhere(reportContext) {
  const accountingCompanyIds = getAccountingCompanyIds(reportContext);
  if (accountingCompanyIds.length === 0) return {};
  if (accountingCompanyIds.length === 1) {
    return { accountingCompanyId: accountingCompanyIds[0] };
  }
  return { accountingCompanyId: { in: accountingCompanyIds } };
}

function createCompanySql(reportContext, Prisma) {
  const companyIds = getReportCompanyIds(reportContext);
  if (companyIds.length === 0) return Prisma.sql`FALSE`;
  const accountingCompanyIds = getAccountingCompanyIds(reportContext);
  const accountingCompanySql = accountingCompanyIds.length
    ? Prisma.sql`AND "accountingCompanyId" IN (${Prisma.join(accountingCompanyIds)})`
    : Prisma.empty;
  return Prisma.sql`"companyId" IN (${Prisma.join(companyIds)}) ${accountingCompanySql}`;
}

module.exports = {
  getReportCompanyIds,
  getAccountingCompanyIds,
  createCompanyWhere,
  createAccountingCompanyWhere,
  createCompanySql,
};
