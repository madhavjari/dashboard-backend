const { Router } = require("express");
const syncSourceController = require("../controllers/syncSourceController");
const verifyToken = require("../middleware/verifyToken");
const { validate } = require("../middleware/zodValidator");
const {
  companyIdParamsSchema,
  createSyncSourceSchema,
} = require("../schema/validatorSchema");

const syncSourceRouter = Router();

syncSourceRouter.get(
  "/api/v1/companies/:companyId/sync-sources",
  verifyToken,
  validate(companyIdParamsSchema),
  syncSourceController.getSyncSourceStatus,
);

syncSourceRouter.post(
  "/api/v1/companies/:companyId/sync-sources",
  verifyToken,
  validate(createSyncSourceSchema),
  syncSourceController.postSyncSource,
);

module.exports = syncSourceRouter;
