const cashflowService = require("../services/cashflowService");

async function getCashflow(req, res, next) {
  try {
    return res.status(200).json(await cashflowService.getCashflow(req.query));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getCashflow };
