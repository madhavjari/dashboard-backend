const { createReportController } = require("./reportControllerFactory.js");

const salesReport = createReportController(["S"], ["SR"]);

module.exports = {
  getKPISummary: salesReport.getKPISummary,
  getCustomerWiseSales: salesReport.getPartyWiseReport,
  getItemWiseSales: salesReport.getItemWiseReport,
  getCustomerDetails: salesReport.getPartyDetails,
};
