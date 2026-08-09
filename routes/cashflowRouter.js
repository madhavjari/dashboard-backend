const { Router } = require("express");
const cashflowController = require("../controllers/cashflowController");
const { resolveReportAccess } = require("../middleware/reportAccess");

const cashflowRouter = Router();

cashflowRouter.get(
  "/api/v1/reports/cashflow",
  resolveReportAccess,
  cashflowController.getCashflow,
);

module.exports = cashflowRouter;
