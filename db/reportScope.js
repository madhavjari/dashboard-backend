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

function createCompanySql(reportContext, Prisma) {
  const companyIds = getReportCompanyIds(reportContext);
  if (companyIds.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`"companyId" IN (${Prisma.join(companyIds)})`;
}

module.exports = {
  getReportCompanyIds,
  createCompanyWhere,
  createCompanySql,
};
