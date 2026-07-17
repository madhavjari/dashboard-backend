const purchaseReportQueries = require("../db/purchaseReportQueries");

async function getItems(filters) {
  return purchaseReportQueries.getItems(filters);
}

async function getSuppliers(filters) {
  return purchaseReportQueries.getSuppliers(filters);
}

async function getTrend(filters) {
  return purchaseReportQueries.getTrend(filters);
}

module.exports = { getItems, getSuppliers, getTrend };
