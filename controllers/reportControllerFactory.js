const {
  getKPI,
  getMonthlySales,
  getPartyDetails,
  getItemWiseSummary,
  getIndividualPartyData,
} = require("../services/reportService.js");
const { getFinancialYearPeriod } = require("../utils/financialYear");

function sendInternalServerError(res, error) {
  console.error(error);
  return res.status(500).json({ message: "Internal Server error" });
}

function normalizePartyName(party) {
  return String(party || "").trim().toUpperCase();
}

function addOutstandingAmounts(data, outstandingReport, outstandingField) {
  const outstandingByParty = new Map(
    (outstandingReport.partySummary ?? []).map((party) => [
      normalizePartyName(party.party),
      Number(party[outstandingField]) || 0,
    ]),
  );

  return data.map((party) => ({
    ...party,
    outstandingAmount:
      outstandingByParty.get(normalizePartyName(party.party)) ?? 0,
  }));
}

function createReportController(
  billCodes,
  returnCodes,
  { getOutstandingReport, outstandingField },
) {
  const allCodes = [...billCodes, ...returnCodes];

  return {
    async getKPISummary(req, res) {
      try {
        const reportPeriod = getFinancialYearPeriod(req.query?.financialYear);
        const data = await getKPI(
          req.reportContext,
          reportPeriod.fromDate,
          reportPeriod.toDate,
          billCodes,
          returnCodes,
        );

        return res.status(200).json({ data });
      } catch (error) {
        return sendInternalServerError(res, error);
      }
    },

    async getMonthlyReport(req, res) {
      try {
        const reportPeriod = getFinancialYearPeriod(req.query?.financialYear);
        const data = await getMonthlySales(
          req.reportContext,
          reportPeriod.fromDate,
          reportPeriod.toDate,
          billCodes,
          returnCodes,
        );

        return res.status(200).json({ data });
      } catch (error) {
        return sendInternalServerError(res, error);
      }
    },

    async getPartyWiseReport(req, res) {
      try {
        const reportPeriod = getFinancialYearPeriod(req.query?.financialYear);
        const [partyData, outstandingReport] = await Promise.all([
          getPartyDetails(
            req.reportContext,
            reportPeriod.fromDate,
            reportPeriod.toDate,
            billCodes,
            returnCodes,
            allCodes,
          ),
          getOutstandingReport(req.reportContext, {
            financialYear: reportPeriod.financialYear,
          }),
        ]);
        const data = addOutstandingAmounts(
          partyData,
          outstandingReport,
          outstandingField,
        );

        return res.status(200).json({
          data,
          outstandingSummary: outstandingReport.summary,
        });
      } catch (error) {
        return sendInternalServerError(res, error);
      }
    },

    async getItemWiseReport(req, res) {
      try {
        const reportPeriod = getFinancialYearPeriod(req.query?.financialYear);
        const { summary, topItems, returnItems } = await getItemWiseSummary(
          req.reportContext,
          reportPeriod.fromDate,
          reportPeriod.toDate,
          billCodes,
          returnCodes,
        );

        return res.status(200).json({ summary, topItems, returnItems });
      } catch (error) {
        return sendInternalServerError(res, error);
      }
    },

    async getPartyDetails(req, res) {
      const { party } = req.query;

      try {
        const reportPeriod = getFinancialYearPeriod(req.query?.financialYear);
        const [data, summary] = await Promise.all([
          getIndividualPartyData(
            req.reportContext,
            reportPeriod.fromDate,
            reportPeriod.toDate,
            "party",
            party,
            allCodes,
          ),
          getPartyDetails(
            req.reportContext,
            reportPeriod.fromDate,
            reportPeriod.toDate,
            billCodes,
            returnCodes,
            allCodes,
            party,
          ),
        ]);

        return res.status(200).json({ data, summary });
      } catch (error) {
        return sendInternalServerError(res, error);
      }
    },
  };
}

module.exports = { createReportController };
