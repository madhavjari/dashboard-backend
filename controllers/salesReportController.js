const {
  getDateRangeSales,
  getSalesKPI,
  getSalesByCustomer,
} = require("../db/salesReportQueries");
const salesReportService = require("../services/salesReportService");

async function getItems(req, res) {
  try {
    const { startDate, endDate } = req.body;
    const data = await getDateRangeSales(startDate, endDate);
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error });
  }
}

async function getKPISummary(req, res) {
  try {
    const salesData = await getSalesKPI("2025-04-01", "2026-03-31");

    return res.status(200).json({
      salesData,
    });
  } catch {
    res.status(500).json({ message: "Internal Server error" });
  }
}

async function getCustomerWiseSales(req, res) {
  try {
    const salesData = await getSalesByCustomer("2025-04-01", "2026-03-31");
    console.log(salesData);
    return res.status(200).json({
      salesData: salesData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server error" });
  }
}

async function getTrend(req, res, next) {
  try {
    return res.status(200).json(await salesReportService.getTrend(req.query));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getItems, getKPISummary, getCustomerWiseSales, getTrend };
