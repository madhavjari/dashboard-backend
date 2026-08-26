const { Router } = require("express");
const {
  getAccountingCompanies,
  getFinancialYears,
} = require("../controllers/financialYearController");
const { resolveReportAccess } = require("../middleware/reportAccess");
const { validate } = require("../middleware/zodValidator");
const { reportPeriodSchema } = require("../schema/validatorSchema");

const financialYearRouter = Router();

financialYearRouter.get(
  "/api/v1/reports/accounting-companies",
  resolveReportAccess,
  getAccountingCompanies,
);

financialYearRouter.get(
  "/api/v1/reports/financial-years",
  resolveReportAccess,
  validate(reportPeriodSchema),
  getFinancialYears,
);

module.exports = financialYearRouter;
