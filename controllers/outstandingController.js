const outstandingService = require("../services/outstandingService");

async function getSales(req, res, next) {
  try {
    return res.status(200).json(await outstandingService.getSales(req.query));
  } catch (error) {
    return next(error);
  }
}

async function getPurchases(req, res, next) {
  try {
    return res
      .status(200)
      .json(await outstandingService.getPurchases(req.query));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSales, getPurchases };
