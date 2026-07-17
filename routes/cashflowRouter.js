const { Router } = require("express");
const cashflowController = require("../controllers/cashflowController");

const cashflowRouter = Router();

cashflowRouter.get(
  "/api/v1/reports/cashflow",
  cashflowController.getCashflow,
);

module.exports = cashflowRouter;
