const { Router } = require("express");
const cashflowController = require("../controllers/cashflowController");
const { resolveReportAccess } = require("../middleware/reportAccess");
const { reportLimiter } = require("../middleware/rateLimiter");

const cashflowRouter = Router();

cashflowRouter.get(
  "/api/v1/reports/cashflow",
  resolveReportAccess,
  reportLimiter,
  cashflowController.getCashflow,
);

module.exports = cashflowRouter;
