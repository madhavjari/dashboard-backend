const { Router } = require("express");
const salesReportController = require("../controllers/salesReportController");
const itemReportController = require("../controllers/itemReportController");
const { validate } = require("../middleware/zodValidator");
const {
  partyDetailsSchema,
  itemDetailsSchema,
} = require("../schema/validatorSchema");

const salesReportRouter = Router();

salesReportRouter.get(
  "/api/v1/reports/sales/KPI-summary",
  salesReportController.getKPISummary,
);
salesReportRouter.get(
  "/api/v1/reports/sales/monthly",
  salesReportController.getMonthlyReport,
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
  validate(partyDetailsSchema),
  salesReportController.getCustomerDetails,
);
salesReportRouter.get(
  "/api/v1/reports/sales/item",
  validate(itemDetailsSchema),
  itemReportController.getSalesItemDetails,
);

module.exports = salesReportRouter;
