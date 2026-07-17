const dashboardService = require("../services/dashboardService");

async function getSummary(req, res, next) {
  const user = req.user;
  try {
    if (user) return res.status(200).json({ user });
    const summary = await dashboardService.getSummary(req.query);
    return res.status(200).json(summary);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSummary };
