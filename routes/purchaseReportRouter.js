const { Router } = require("express");
const purchaseReportController = require("../controllers/purchaseReportController");
const itemReportController = require("../controllers/itemReportController");
const { resolveReportAccess } = require("../middleware/reportAccess");
const { validate } = require("../middleware/zodValidator");
const {
  partyDetailsSchema,
  itemDetailsSchema,
} = require("../schema/validatorSchema");

const purchaseReportRouter = Router();

purchaseReportRouter.use("/api/v1/reports/purchases", resolveReportAccess);

purchaseReportRouter.get(
  "/api/v1/reports/purchases/KPI-summary",
  purchaseReportController.getKPISummary,
);
purchaseReportRouter.get(
  "/api/v1/reports/purchases/monthly",
  purchaseReportController.getMonthlyReport,
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
  validate(partyDetailsSchema),
  purchaseReportController.getSupplierDetails,
);
purchaseReportRouter.get(
  "/api/v1/reports/purchases/item",
  validate(itemDetailsSchema),
  itemReportController.getPurchaseItemDetails,
);

module.exports = purchaseReportRouter;
