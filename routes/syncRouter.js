const { Router } = require("express");
const syncController = require("../controllers/syncController");
const { syncApiKeyAuth } = require("../middleware/apiKeyAuth");
const { validate } = require("../middleware/zodValidator");
const {
  syncBillsSchema,
  syncCompaniesSchema,
  syncVouchersSchema,
} = require("../schema/validatorSchema");

const syncRouter = Router();

syncRouter.post(
  "/api/v1/sync/companies",
  syncApiKeyAuth,
  validate(syncCompaniesSchema),
  syncController.postAccountingCompanies,
);

syncRouter.post(
  "/api/v1/sync/bills",
  syncApiKeyAuth,
  validate(syncBillsSchema),
  syncController.postBills,
);

syncRouter.post(
  "/api/v1/sync/vouchers",
  syncApiKeyAuth,
  validate(syncVouchersSchema),
  syncController.postPaymentVouchers,
);

module.exports = syncRouter;
