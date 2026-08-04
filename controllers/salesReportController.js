const { createReportController } = require("./reportControllerFactory.js");
const { getSales } = require("../db/outstandingQueries.js");

const salesReport = createReportController(["S"], ["SR"], {
  getOutstandingReport: getSales,
  outstandingField: "amountToCollect",
});

module.exports = {
  getKPISummary: salesReport.getKPISummary,
  getMonthlyReport: salesReport.getMonthlyReport,
  getCustomerWiseSales: salesReport.getPartyWiseReport,
  getItemWiseSales: salesReport.getItemWiseReport,
  getCustomerDetails: salesReport.getPartyDetails,
};
