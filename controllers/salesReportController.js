const {
  getSalesKPI,
  getSalesByCustomer,
  getItemWiseSummary,
  getCustomerPurchases,
} = require("../db/salesReportQueries");
const salesReportService = require("../services/salesReportService");

const { Prisma } = require("../generated/neon/client.js");
async function getItemWiseSales(req, res) {
  try {
    const { summary, topItems, itemGroupSales } = await getItemWiseSummary(
      "2025-04-01",
      "2026-03-31",
    );
    return res.status(200).json({ summary, topItems, itemGroupSales });
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function getKPISummary(req, res) {
  try {
    const salesData = await getSalesKPI("2025-04-01", "2026-03-31");

    return res.status(200).json({
      salesData,
    });
  } catch {
    res.status(500).json({ message: "Internal Server error" });
  }
}

async function getCustomerWiseSales(req, res) {
  try {
    const salesData = await getSalesByCustomer("2025-04-01", "2026-03-31");
    return res.status(200).json({
      salesData: salesData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server error" });
  }
}

async function getCustomerDetails(req, res) {
  const { party } = req.query;
  const agent = party.toUpperCase();
  const filter = party ? Prisma.sql`AND party = ${agent} ` : Prisma.empty;
  try {
    const customerData = await getCustomerPurchases(
      "2025-04-01",
      "2026-03-31",
      agent,
    );
    const summary = await getSalesByCustomer(
      "2025-04-01",
      "2026-03-31",
      filter,
    );
    console.log(summary);
    return res.status(200).json({
      customerData,
      summary,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server error" });
  }
}

async function getTrend(req, res, next) {
  try {
    return res.status(200).json(await salesReportService.getTrend(req.query));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getItemWiseSales,
  getKPISummary,
  getCustomerWiseSales,
  getTrend,
  getCustomerDetails,
};
