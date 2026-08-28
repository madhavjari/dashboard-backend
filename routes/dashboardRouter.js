const { Router } = require("express");
const dashboardController = require("../controllers/dashboardController");
const verifyToken = require("../middleware/verifyToken");
const { authenticatedUserLimiter } = require("../middleware/rateLimiter");

const dashboardRouter = Router();

dashboardRouter.get(
  "/api/v1/dashboard/summary",
  verifyToken,
  authenticatedUserLimiter,
  dashboardController.getSummary,
);

module.exports = dashboardRouter;
