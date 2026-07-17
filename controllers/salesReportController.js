const salesReportService = require("../services/salesReportService");

async function getItems(req, res, next) {
  try {
    return res.status(200).json(await salesReportService.getItems(req.query));
  } catch (error) {
    return next(error);
  }
}

async function getCustomers(req, res, next) {
  try {
    return res
      .status(200)
      .json(await salesReportService.getCustomers(req.query));
  } catch (error) {
    return next(error);
  }
}

async function getTrend(req, res, next) {
  try {
    return res.status(200).json(await salesReportService.getTrend(req.query));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getItems, getCustomers, getTrend };
