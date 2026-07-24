const {
  getKPI,
  getPartyDetails,
  getItemWiseSummary,
  getIndividualPartyData,
} = require("../db/spReportQueries.js");

const { Prisma } = require("../generated/neon/client.js");

async function getKPISummary(req, res) {
  try {
    const data = await getKPI("2025-04-01", "2026-03-31", ["P", "OP"], ["PR"]);

    return res.status(200).json({
      data,
    });
  } catch {
    res.status(500).json({ message: "Internal Server error" });
  }
}

async function getSupplierWisePurchase(req, res) {
  try {
    const data = await getPartyDetails(
      "2025-04-01",
      "2026-03-31",
      ["P", "OP"],
      ["PR"],
      ["P", "OP", "PR"],
    );
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
      ["P", "OP"],
      ["PR"],
    );
    return res.status(200).json({ summary, topItems, returnItems });
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function getSupplierDetails(req, res) {
  const { party } = req.query;
  const partyUpper = party.toUpperCase();
  const filter = party ? Prisma.sql`AND party = ${partyUpper} ` : Prisma.empty;
  try {
    const data = await getIndividualPartyData(
      "2025-04-01",
      "2026-03-31",
      "party",
      partyUpper,
      ["P", "OP", "PR"],
    );
    const summary = await getPartyDetails(
      "2025-04-01",
      "2026-03-31",
      ["P", "OP"],
      ["PR"],
      ["P", "OP", "PR"],
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

// async function getSalesItemDetails(req, res) {
//   const { item } = req.query;
//   const itemUpper = item.toUpperCase();
//   const filter = item ? Prisma.sql`AND party = ${itemUpper} ` : Prisma.empty;
//   try {
//     const data = await getIndividualItemData(
//       "2025-04-01",
//       "2026-03-31",
//       "itemName",
//       itemUpper,
//       ["P", "OP", "PR"],
//     );
//     const summary = await getItemDetails(
//       "2025-04-01",
//       "2026-03-31",
//       ["P", "OP"],
//       ["PR"],
//       ["P", "OP", "PR"],
//       filter,
//     );
//     return res.status(200).json({
//       data,
//       summary,
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Internal Server error" });
//   }
// }

module.exports = {
  getSupplierWisePurchase,
  getKPISummary,
  getItemWisePurchases,
  getSupplierDetails,
};
