const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
require("dotenv/config");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 30;
const isProd = process.env.NODE_ENV === "production";

function getAccessToken(id) {
  return jwt.sign(
    {
      sub: id,
    },
    process.env.JWT_SECRET_KEY,
    {
      algorithm: "HS256",
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    },
  );
}

function generatedRefreshToken() {
  const refreshToken = crypto.randomBytes(64).toString("hex");
  const refreshTokenHash = hashString(refreshToken);
  return { refreshToken, refreshTokenHash };
}

function generateToken() {
  const token = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashString(token);
  return { token, tokenHash };
}

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/api/auth",
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

function hashString(string) {
  return crypto.createHash("sha256").update(string).digest("hex");
}

function refreshExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

module.exports = {
  getAccessToken,
  generatedRefreshToken,
  generateToken,
  refreshCookieOptions,
  hashString,
  refreshExpiry,
};
