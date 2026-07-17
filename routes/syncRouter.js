const { Router } = require("express");
const syncController = require("../controllers/syncController");

const { apiKeyAuth } = require("../middleware/apiKeyAuth");

const syncRouter = Router();
syncRouter.post("/api/v1/billdata", apiKeyAuth, syncController.postBillData);

module.exports = syncRouter;
