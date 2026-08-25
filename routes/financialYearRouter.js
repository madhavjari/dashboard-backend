const { Router } = require("express");
const {
  getFinancialYears,
} = require("../controllers/financialYearController");
const { resolveReportAccess } = require("../middleware/reportAccess");

const financialYearRouter = Router();

financialYearRouter.get(
  "/api/v1/reports/financial-years",
  resolveReportAccess,
  getFinancialYears,
);

module.exports = financialYearRouter;
