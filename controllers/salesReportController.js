const {
  getSalesKPI,
  getSalesByCustomer,
  getItemWiseSummary,
  getCustomerPurchases,
} = require("../db/salesReportQueries");

const { Prisma } = require("../generated/neon/client.js");
async function getItemWiseSales(req, res) {
  try {
    const { summary, topItems, returnItems } = await getItemWiseSummary(
      "2025-04-01",
      "2026-03-31",
    );
    return res.status(200).json({ summary, topItems, returnItems });
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function getKPISummary(req, res) {
  try {
    const data = await getSalesKPI("2025-04-01", "2026-03-31");

    return res.status(200).json({
      data,
    });
  } catch {
    res.status(500).json({ message: "Internal Server error" });
  }
}

async function getCustomerWiseSales(req, res) {
  try {
    const data = await getSalesByCustomer("2025-04-01", "2026-03-31");
    return res.status(200).json({
      data,
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
    const data = await getCustomerPurchases("2025-04-01", "2026-03-31", agent);
    const summary = await getSalesByCustomer(
      "2025-04-01",
      "2026-03-31",
      filter,
    );
    return res.status(200).json({
      data,
      summary,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server error" });
  }
}

module.exports = {
  getItemWiseSales,
  getKPISummary,
  getCustomerWiseSales,
  getCustomerDetails,
};
