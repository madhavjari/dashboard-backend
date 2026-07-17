const outstandingQueries = require("../db/outstandingQueries");

async function getSales(filters) {
  return outstandingQueries.getSales(filters);
}

async function getPurchases(filters) {
  return outstandingQueries.getPurchases(filters);
}

module.exports = { getSales, getPurchases };
