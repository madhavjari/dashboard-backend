const {
  findAvailableAccountingCompanies,
  findAvailableFinancialYears,
} = require("../db/financialYearQueries");

async function getAccountingCompanies(req, res) {
  try {
    const companies = await findAvailableAccountingCompanies(
      req.reportContext,
    );
    const data = companies.map((company) => ({
      id: company.id,
      name: company.name,
      accountName: company.company.name,
    }));
    return res.status(200).json({ data });
  } catch (error) {
    console.error("Failed to load accounting companies:", error);
    return res.status(500).json({ message: "Internal Server error" });
  }
}

async function getFinancialYears(req, res) {
  try {
    const data = await findAvailableFinancialYears(req.reportContext);
    return res.status(200).json({ data });
  } catch (error) {
    console.error("Failed to load available financial years:", error);
    return res.status(500).json({ message: "Internal Server error" });
  }
}

module.exports = { getAccountingCompanies, getFinancialYears };
