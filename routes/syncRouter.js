const { Router } = require("express");
const syncController = require("../controller/syncController");

const syncRouter = Router();
const apiKeyAuth = require("../middleware/apiKeyAuth");

syncRouter.post("/api/billdata", apiKeyAuth, syncController.postBillData);

module.exports = syncRouter;
