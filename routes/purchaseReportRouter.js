const { Router } = require("express");
const purchaseReportController = require("../controllers/purchaseReportController");

const purchaseReportRouter = Router();

purchaseReportRouter.get(
  "/api/v1/reports/purchases/items",
  purchaseReportController.getItems,
);
purchaseReportRouter.get(
  "/api/v1/reports/purchases/suppliers",
  purchaseReportController.getSuppliers,
);
purchaseReportRouter.get(
  "/api/v1/reports/purchases/trend",
  purchaseReportController.getTrend,
);

module.exports = purchaseReportRouter;
