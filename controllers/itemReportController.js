const { getIndividualItemDetails } = require("../services/reportService.js");
const { getFinancialYearPeriod } = require("../utils/financialYear");

function createItemDetailsHandler(billCodes, returnCodes) {
  return async function getItemDetails(req, res) {
    const { item: itemName } = req.query;

    try {
      const reportPeriod = getFinancialYearPeriod(req.query?.financialYear);
      const report = await getIndividualItemDetails(
        req.reportContext,
        reportPeriod.fromDate,
        reportPeriod.toDate,
        itemName,
        billCodes,
        returnCodes,
      );
      return res.status(200).json(report);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server error" });
    }
  };
}

module.exports = {
  getSalesItemDetails: createItemDetailsHandler(["S"], ["SR"]),
  getPurchaseItemDetails: createItemDetailsHandler(["P", "OP", "FJ"], ["PR"]),
};
