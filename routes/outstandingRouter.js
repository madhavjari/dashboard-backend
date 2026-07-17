const { Router } = require("express");
const outstandingController = require("../controllers/outstandingController");

const outstandingRouter = Router();

outstandingRouter.get(
  "/api/v1/reports/outstanding/sales",
  outstandingController.getSales,
);
outstandingRouter.get(
  "/api/v1/reports/outstanding/purchases",
  outstandingController.getPurchases,
);

module.exports = outstandingRouter;
