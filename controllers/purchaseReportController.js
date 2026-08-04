const { createReportController } = require("./reportControllerFactory.js");

const purchaseReport = createReportController(["P", "OP", "FJ"], ["PR"]);

module.exports = {
  getKPISummary: purchaseReport.getKPISummary,
  getMonthlyReport: purchaseReport.getMonthlyReport,
  getSupplierWisePurchase: purchaseReport.getPartyWiseReport,
  getItemWisePurchases: purchaseReport.getItemWiseReport,
  getSupplierDetails: purchaseReport.getPartyDetails,
};
