const { findUserFromApi } = require("../db/authQueries");
const { hashString } = require("../utils/hashString");

async function apiKeyAuth(req, res, next) {
  try {
    const key = req.header("x-api-key");
    if (!key) return res.status(401).json({ message: "No api key provided" });
    const hashKey = hashString(key);
    const user = await findUserFromApi(hashKey);
    if (!user) return res.status(401).json({ message: "Invalid key" });
    req.user = user;
    next();
  } catch (err) {
    console.error("API key authentication failed:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { apiKeyAuth };
