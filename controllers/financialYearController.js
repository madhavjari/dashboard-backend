const {
  findAvailableFinancialYears,
} = require("../db/financialYearQueries");

async function getFinancialYears(req, res) {
  try {
    const data = await findAvailableFinancialYears(req.reportContext);
    return res.status(200).json({ data });
  } catch (error) {
    console.error("Failed to load available financial years:", error);
    return res.status(500).json({ message: "Internal Server error" });
  }
}

module.exports = { getFinancialYears };
