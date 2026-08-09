const { Router } = require("express");
const outstandingController = require("../controllers/outstandingController");
const { resolveReportAccess } = require("../middleware/reportAccess");

const outstandingRouter = Router();

outstandingRouter.use("/api/v1/reports/outstanding", resolveReportAccess);

outstandingRouter.get(
  "/api/v1/reports/outstanding/sales",
  outstandingController.getSales,
);
outstandingRouter.get(
  "/api/v1/reports/outstanding/purchases",
  outstandingController.getPurchases,
);

module.exports = outstandingRouter;
