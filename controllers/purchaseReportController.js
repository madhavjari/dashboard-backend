const {
  getPurchaseKPI,
  getPurchasesBySupplier,
  getItemWiseSummary,
  getPartyPurchases,
} = require("../db/purchaseReportQueries");

const { Prisma } = require("../generated/neon/client.js");

async function getKPISummary(req, res) {
  try {
    const data = await getPurchaseKPI("2025-04-01", "2026-03-31");

    return res.status(200).json({
      data,
    });
  } catch {
    res.status(500).json({ message: "Internal Server error" });
  }
}

async function getSupplierWisePurchase(req, res) {
  try {
    const data = await getPurchasesBySupplier("2025-04-01", "2026-03-31");
    return res.status(200).json({
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server error" });
  }
}

async function getItemWisePurchases(req, res) {
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

async function getPartyDetails(req, res) {
  const { party } = req.query;
  const agent = party.toUpperCase();
  const filter = party ? Prisma.sql`AND party = ${agent} ` : Prisma.empty;
  try {
    const data = await getPartyPurchases("2025-04-01", "2026-03-31", agent);
    const summary = await getPurchasesBySupplier(
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
  getSupplierWisePurchase,
  getKPISummary,
  getItemWisePurchases,
  getPartyDetails,
};
