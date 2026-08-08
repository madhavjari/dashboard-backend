const { Router } = require("express");
const syncController = require("../controllers/syncController");

const { syncApiKeyAuth } = require("../middleware/apiKeyAuth");

const syncRouter = Router();
syncRouter.post(
  "/api/v1/billdata",
  syncApiKeyAuth,
  syncController.postBillData,
);

module.exports = syncRouter;
