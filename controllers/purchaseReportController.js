const { createReportController } = require("./reportControllerFactory.js");
const { getPurchases } = require("../services/outstandingService.js");

const purchaseReport = createReportController(["P", "OP", "FJ"], ["PR"], {
  getOutstandingReport: getPurchases,
  outstandingField: "amountToPay",
});

module.exports = {
  getKPISummary: purchaseReport.getKPISummary,
  getMonthlyReport: purchaseReport.getMonthlyReport,
  getSupplierWisePurchase: purchaseReport.getPartyWiseReport,
  getItemWisePurchases: purchaseReport.getItemWiseReport,
  getSupplierDetails: purchaseReport.getPartyDetails,
};
