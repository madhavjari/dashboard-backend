const purchaseReportService = require("../services/purchaseReportService");

async function getItems(req, res, next) {
  try {
    return res.status(200).json(await purchaseReportService.getItems(req.query));
  } catch (error) {
    return next(error);
  }
}

async function getSuppliers(req, res, next) {
  try {
    return res
      .status(200)
      .json(await purchaseReportService.getSuppliers(req.query));
  } catch (error) {
    return next(error);
  }
}

async function getTrend(req, res, next) {
  try {
    return res
      .status(200)
      .json(await purchaseReportService.getTrend(req.query));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getItems, getSuppliers, getTrend };
