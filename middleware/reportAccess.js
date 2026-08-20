const verifyToken = require("./verifyToken");
const { DEMO_TENANT } = require("../config/demoTenant");

function createAuthenticatedContext(user) {
  const memberships = Array.isArray(user.companies) ? user.companies : [];
  const companyIds = memberships
    .map((membership) => membership.companyId)
    .filter(Boolean);

  return {
    mode: "authenticated",
    userId: user.id,
    companyIds,
  };
}

function resolveReportAccess(req, res, next) {
  const authorization = req.headers.authorization;

  if (typeof authorization === "undefined") {
    req.reportContext = {
      mode: "demo",
      companyId:
        process.env.DEMO_COMPANY_ID || DEMO_TENANT.companyId,
    };
    return next();
  }

  return verifyToken(req, res, () => {
    req.reportContext = createAuthenticatedContext(req.user);
    return next();
  });
}

module.exports = {
  resolveReportAccess,
};
