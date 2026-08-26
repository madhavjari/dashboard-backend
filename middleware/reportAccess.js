const verifyToken = require("./verifyToken");
const { DEMO_TENANT } = require("../config/demoTenant");

function normalizeAccountingCompanyIds(value) {
  const values = Array.isArray(value) ? value : [value];

  return [
    ...new Set(
      values
        .flatMap((entry) => String(entry || "").split(","))
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

function createAuthenticatedContext(user, accountingCompanyIds = []) {
  const memberships = Array.isArray(user.companies) ? user.companies : [];
  const companyIds = memberships
    .map((membership) => membership.companyId)
    .filter(Boolean);

  const context = {
    mode: "authenticated",
    userId: user.id,
    companyIds,
  };
  if (accountingCompanyIds.length) {
    context.accountingCompanyIds = accountingCompanyIds;
  }
  return context;
}

function resolveReportAccess(req, res, next) {
  const authorization = req.headers.authorization;
  const accountingCompanyIds = normalizeAccountingCompanyIds(
    req.query?.accountingCompanyIds,
  );

  if (typeof authorization === "undefined") {
    req.reportContext = {
      mode: "demo",
      companyId:
        process.env.DEMO_COMPANY_ID || DEMO_TENANT.companyId,
    };
    if (accountingCompanyIds.length) {
      req.reportContext.accountingCompanyIds = accountingCompanyIds;
    }
    return next();
  }

  return verifyToken(req, res, () => {
    req.reportContext = createAuthenticatedContext(
      req.user,
      accountingCompanyIds,
    );
    return next();
  });
}

module.exports = {
  createAuthenticatedContext,
  normalizeAccountingCompanyIds,
  resolveReportAccess,
};
