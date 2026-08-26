const DEFAULT_FINANCIAL_YEAR = "2025-2026";

function getFinancialYearPeriod(financialYear = DEFAULT_FINANCIAL_YEAR) {
  const [fromYear, toYear] = financialYear.split("-").map(Number);
  return {
    financialYear,
    fromDate: `${fromYear}-04-01`,
    toDate: `${toYear}-04-01`,
  };
}

function financialYearFromPeriod(fromDate, toDate) {
  return `${new Date(fromDate).getUTCFullYear()}-${new Date(toDate).getUTCFullYear()}`;
}

module.exports = {
  DEFAULT_FINANCIAL_YEAR,
  financialYearFromPeriod,
  getFinancialYearPeriod,
};
