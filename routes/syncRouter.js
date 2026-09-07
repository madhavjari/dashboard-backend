const { Router } = require("express");
const syncController = require("../controllers/syncController");
const syncApiKeyAuth = require("../middleware/apiKeyAuth");
const { validate } = require("../middleware/zodValidator");
const {
  syncBillsSchema,
  syncCompaniesSchema,
  syncRecordDeletionsSchema,
  syncVouchersSchema,
} = require("../schema/validatorSchema");

const syncRouter = Router();

//for creating new companies for same user.
//checks apikey, insert or update new company name details, updates last sync
syncRouter.post(
  "/api/v1/sync/companies",
  syncApiKeyAuth,
  validate(syncCompaniesSchema),
  syncController.postAccountingCompanies,
);

syncRouter.delete(
  "/api/v1/sync/bills",
  syncApiKeyAuth,
  validate(syncRecordDeletionsSchema),
  syncController.deleteBills,
);

//use of resolved company by creating Set() of companies
// and Map()(key value pair) of companies and its externalid
syncRouter.post(
  "/api/v1/sync/bills",
  syncApiKeyAuth,
  validate(syncBillsSchema),
  syncController.postBills,
);

syncRouter.delete(
  "/api/v1/sync/vouchers",
  syncApiKeyAuth,
  validate(syncRecordDeletionsSchema),
  syncController.deletePaymentVouchers,
);

syncRouter.post(
  "/api/v1/sync/vouchers",
  syncApiKeyAuth,
  validate(syncVouchersSchema),
  syncController.postPaymentVouchers,
);

module.exports = syncRouter;
