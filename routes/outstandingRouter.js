const { Router } = require("express");
const outstandingController = require("../controllers/outstandingController");
const { resolveReportAccess } = require("../middleware/reportAccess");
const { reportLimiter } = require("../middleware/rateLimiter");
const { validate } = require("../middleware/zodValidator");
const { reportPeriodSchema } = require("../schema/validatorSchema");

const outstandingRouter = Router();

outstandingRouter.use(
  "/api/v1/reports/outstanding",
  resolveReportAccess,
  reportLimiter,
  validate(reportPeriodSchema),
);

outstandingRouter.get(
  "/api/v1/reports/outstanding/sales",
  outstandingController.getSales,
);
outstandingRouter.get(
  "/api/v1/reports/outstanding/purchases",
  outstandingController.getPurchases,
);

module.exports = outstandingRouter;
