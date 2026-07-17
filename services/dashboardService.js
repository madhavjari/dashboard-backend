const dashboardQueries = require("../db/dashboardQueries");

async function getSummary(filters) {
  return dashboardQueries.getSummary(filters);
}

module.exports = { getSummary };
