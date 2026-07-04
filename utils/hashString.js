const crypto = require("crypto");

function hashString(string) {
  return crypto.createHash("sha256").update(string).digest("hex");
}

module.exports = { hashString };
