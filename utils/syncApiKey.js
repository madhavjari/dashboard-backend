const crypto = require("node:crypto");
const { hashString } = require("./token");

function generateSyncApiKey() {
  const keyPrefix = `sync_${crypto.randomBytes(6).toString("hex")}`;
  const secret = crypto.randomBytes(32).toString("base64url");
  const apiKey = `${keyPrefix}.${secret}`;

  return {
    apiKey,
    keyPrefix,
    keyHash: hashString(apiKey),
  };
}

module.exports = { generateSyncApiKey };
