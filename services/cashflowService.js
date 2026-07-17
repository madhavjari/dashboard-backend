const cashflowQueries = require("../db/cashflowQueries");

async function getCashflow(filters) {
  return cashflowQueries.getCashflow(filters);
}

module.exports = { getCashflow };
