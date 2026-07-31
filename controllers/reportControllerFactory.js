const {
  getKPI,
  getMonthlySales,
  getPartyDetails,
  getItemWiseSummary,
  getIndividualPartyData,
} = require("../db/spReportQueries.js");
const { Prisma } = require("../generated/neon/client.js");

const REPORT_PERIOD = {
  fromDate: "2025-04-01",
  toDate: "2026-04-01",
};

function sendInternalServerError(res, error) {
  console.error(error);
  return res.status(500).json({ message: "Internal Server error" });
}

function createReportController(billCodes, returnCodes) {
  const allCodes = [...billCodes, ...returnCodes];

  return {
    async getKPISummary(req, res) {
      try {
        const data = await getKPI(
          REPORT_PERIOD.fromDate,
          REPORT_PERIOD.toDate,
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
        const data = await getMonthlySales(
          REPORT_PERIOD.fromDate,
          REPORT_PERIOD.toDate,
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
        const data = await getPartyDetails(
          REPORT_PERIOD.fromDate,
          REPORT_PERIOD.toDate,
          billCodes,
          returnCodes,
          allCodes,
        );

        return res.status(200).json({ data });
      } catch (error) {
        return sendInternalServerError(res, error);
      }
    },

    async getItemWiseReport(req, res) {
      try {
        const { summary, topItems, returnItems } = await getItemWiseSummary(
          REPORT_PERIOD.fromDate,
          REPORT_PERIOD.toDate,
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
      const filter = Prisma.sql`AND party = ${party}`;

      try {
        const [data, summary] = await Promise.all([
          getIndividualPartyData(
            REPORT_PERIOD.fromDate,
            REPORT_PERIOD.toDate,
            "party",
            party,
            allCodes,
          ),
          getPartyDetails(
            REPORT_PERIOD.fromDate,
            REPORT_PERIOD.toDate,
            billCodes,
            returnCodes,
            allCodes,
            filter,
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
