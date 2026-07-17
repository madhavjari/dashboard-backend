const salesReportQueries = require("../db/salesReportQueries");

async function getItems(filters) {
  return salesReportQueries.getItems(filters);
}

async function getCustomers(filters) {
  return salesReportQueries.getCustomers(filters);
}

async function getTrend(filters) {
  return salesReportQueries.getTrend(filters);
}

module.exports = { getItems, getCustomers, getTrend };
