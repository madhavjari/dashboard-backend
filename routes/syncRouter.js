const { Router } = require("express");
const syncController = require("../controller/syncController");

const { apiKeyAuth } = require("../middleware/apiKeyAuth");

const syncRouter = Router();
syncRouter.post("/api/billdata", apiKeyAuth, syncController.postBillData);

module.exports = syncRouter;
