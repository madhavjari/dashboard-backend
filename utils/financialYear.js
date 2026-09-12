const getCurrentFinancialYear = () => {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;

  const fromYear = month >= 4 ? year : year - 1;

  return `${fromYear}-${fromYear + 1}`;
};

const DEFAULT_FINANCIAL_YEAR = getCurrentFinancialYear();

function getFinancialYearPeriod(financialYear = DEFAULT_FINANCIAL_YEAR) {
  const [fromYear, toYear] = financialYear.split("-").map(Number);
  return {
    financialYear,
    fromDate: `${fromYear}-04-01`,
    toDate: `${toYear}-04-01`,
  };
}

function getRequestedReportPeriod({
  financialYear = DEFAULT_FINANCIAL_YEAR,
  fromDate,
  toDate,
} = {}) {
  const financialYearPeriod = getFinancialYearPeriod(financialYear);

  if (!fromDate || !toDate) {
    return financialYearPeriod;
  }

  const exclusiveToDate = new Date(`${toDate}T00:00:00.000Z`);
  exclusiveToDate.setUTCDate(exclusiveToDate.getUTCDate() + 1);

  return {
    financialYear,
    fromDate,
    toDate: exclusiveToDate.toISOString().slice(0, 10),
  };
}

function financialYearFromPeriod(fromDate, toDate) {
  return `${new Date(fromDate).getUTCFullYear()}-${new Date(toDate).getUTCFullYear()}`;
}

module.exports = {
  DEFAULT_FINANCIAL_YEAR,
  financialYearFromPeriod,
  getFinancialYearPeriod,
  getRequestedReportPeriod,
  getCurrentFinancialYear,
};
