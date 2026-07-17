const { Router } = require("express");
const salesReportController = require("../controllers/salesReportController");

const salesReportRouter = Router();

salesReportRouter.get(
  "/api/v1/reports/sales/items",
  salesReportController.getItems,
);
salesReportRouter.get(
  "/api/v1/reports/sales/customers",
  salesReportController.getCustomers,
);
salesReportRouter.get(
  "/api/v1/reports/sales/trend",
  salesReportController.getTrend,
);

module.exports = salesReportRouter;
