const { Router } = require("express");
const dashboardController = require("../controllers/dashboardController");
const verifyToken = require("../middleware/verifyToken");

const dashboardRouter = Router();

dashboardRouter.get(
  "/api/v1/dashboard/summary",
  verifyToken,
  dashboardController.getSummary,
);

module.exports = dashboardRouter;
