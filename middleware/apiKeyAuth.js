const { authenticateSyncApiKey } = require("../db/syncSourceQueries");
const { hashString } = require("../utils/token");

function getPresentedApiKey(req) {
  const authorization = req.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();

  return req.get("x-api-key")?.trim() || null;
}

async function syncApiKeyAuth(req, res, next) {
  try {
    const apiKey = getPresentedApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        code: "SYNC_API_KEY_REQUIRED",
        message: "Sync API key is required.",
      });
    }

    const syncAuth = await authenticateSyncApiKey(hashString(apiKey));
    if (!syncAuth) {
      return res.status(401).json({
        code: "INVALID_SYNC_API_KEY",
        message: "Invalid or inactive sync API key.",
      });
    }

    req.syncAuth = syncAuth;
    return next();
  } catch (error) {
    console.error("Sync API key authentication failed:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  syncApiKeyAuth,
  // Keep the old export name temporarily for callers that have not migrated.
  apiKeyAuth: syncApiKeyAuth,
};
