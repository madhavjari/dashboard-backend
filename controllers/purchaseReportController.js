const { createReportController } = require("./reportControllerFactory.js");

const purchaseReport = createReportController(["P", "OP"], ["PR"]);

module.exports = {
  getKPISummary: purchaseReport.getKPISummary,
  getSupplierWisePurchase: purchaseReport.getPartyWiseReport,
  getItemWisePurchases: purchaseReport.getItemWiseReport,
  getSupplierDetails: purchaseReport.getPartyDetails,
};
