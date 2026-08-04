const { getIndividualItemDetails } = require("../db/spReportQueries.js");

const REPORT_PERIOD = {
  fromDate: "2025-04-01",
  toDate: "2026-04-01",
};

function createItemDetailsHandler(billCodes, returnCodes) {
  return async function getItemDetails(req, res) {
    const { item: itemName } = req.query;

    try {
      const report = await getIndividualItemDetails(
        REPORT_PERIOD.fromDate,
        REPORT_PERIOD.toDate,
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
