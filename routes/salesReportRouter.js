const { Router } = require("express");
const salesReportController = require("../controllers/salesReportController");

const salesReportRouter = Router();

salesReportRouter.get(
  "/api/v1/reports/sales/KPI-summary",
  salesReportController.getKPISummary,
);
salesReportRouter.get(
  "/api/v1/reports/sales/customers",
  salesReportController.getCustomerWiseSales,
);
salesReportRouter.get(
  "/api/v1/reports/sales/items",
  salesReportController.getItemWiseSales,
);

salesReportRouter.get(
  "/api/v1/reports/sales/customer",
  salesReportController.getCustomerDetails,
);
salesReportRouter.get(
  "/api/v1/reports/sales/trend",
  salesReportController.getTrend,
);

module.exports = salesReportRouter;
