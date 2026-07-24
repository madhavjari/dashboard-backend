const { Router } = require("express");
const purchaseReportController = require("../controllers/purchaseReportController");

const purchaseReportRouter = Router();

purchaseReportRouter.get(
  "/api/v1/reports/purchases/KPI-summary",
  purchaseReportController.getKPISummary,
);
purchaseReportRouter.get(
  "/api/v1/reports/purchases/suppliers",
  purchaseReportController.getSupplierWisePurchase,
);
purchaseReportRouter.get(
  "/api/v1/reports/purchases/items",
  purchaseReportController.getItemWisePurchases,
);
purchaseReportRouter.get(
  "/api/v1/reports/purchases/supplier",
  purchaseReportController.getSupplierDetails,
);

module.exports = purchaseReportRouter;
