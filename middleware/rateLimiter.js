const crypto = require("node:crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const MINUTE = 60 * 1000;

const RATE_LIMITS = Object.freeze({
  GENERAL_IP: { windowMs: MINUTE, limit: 500, identifier: "general-api" },
  AUTHENTICATED_USER: {
    windowMs: MINUTE,
    limit: 300,
    identifier: "authenticated-user",
  },
  LOGIN_IP: { windowMs: 15 * MINUTE, limit: 10, identifier: "login-ip" },
  LOGIN_EMAIL: {
    windowMs: 15 * MINUTE,
    limit: 10,
    identifier: "login-account",
  },
  REGISTER_IP: {
    windowMs: 60 * MINUTE,
    limit: 5,
    identifier: "registration-ip",
  },
  RESEND_VERIFICATION_IP: {
    windowMs: 15 * MINUTE,
    limit: 10,
    identifier: "resend-verification-ip",
  },
  RESEND_VERIFICATION_EMAIL: {
    windowMs: 15 * MINUTE,
    limit: 3,
    identifier: "resend-verification-account",
  },
  FORGOT_PASSWORD_IP: {
    windowMs: 15 * MINUTE,
    limit: 10,
    identifier: "forgot-password-ip",
  },
  FORGOT_PASSWORD_EMAIL: {
    windowMs: 15 * MINUTE,
    limit: 5,
    identifier: "forgot-password-account",
  },
  EMAIL_VERIFICATION_IP: {
    windowMs: 15 * MINUTE,
    limit: 30,
    identifier: "email-verification-ip",
  },
  PASSWORD_RESET_TOKEN_IP: {
    windowMs: 15 * MINUTE,
    limit: 30,
    identifier: "password-reset-token-ip",
  },
  PASSWORD_RESET_IP: {
    windowMs: 15 * MINUTE,
    limit: 10,
    identifier: "password-reset-ip",
  },
  REFRESH_TOKEN_IP: {
    windowMs: 15 * MINUTE,
    limit: 120,
    identifier: "refresh-token-ip",
  },
  REPORTS: { windowMs: MINUTE, limit: 60, identifier: "reports" },
});

function rateLimitHandler(_req, res) {
  return res.status(429).json({
    message: "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  });
}

function ipKey(req) {
  return `ip:${ipKeyGenerator(req.ip)}`;
}

function userKey(req) {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  return ipKey(req);
}

function normalizeEmail(req) {
  return String(req.body?.email || "").trim().toLowerCase();
}

function emailKey(req) {
  const email = normalizeEmail(req);
  if (!email) {
    return ipKey(req);
  }

  // Hashing avoids retaining email addresses in this store or a future shared one.
  const digest = crypto.createHash("sha256").update(email).digest("hex");
  return `email:${digest}`;
}

function createRateLimiter(policy, overrides = {}) {
  return rateLimit({
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: (req) => req.method === "OPTIONS",
    ...policy,
    ...overrides,
  });
}

// The maintained MemoryStore periodically discards expired entries and resets on
// process restart. Before using multiple Node processes or replicas, supply a new
// shared store here (for example Redis) so every instance sees the same counters.
const generalIpLimiter = createRateLimiter(RATE_LIMITS.GENERAL_IP);
const authenticatedUserLimiter = createRateLimiter(
  RATE_LIMITS.AUTHENTICATED_USER,
  { keyGenerator: userKey },
);
const loginIpLimiter = createRateLimiter(RATE_LIMITS.LOGIN_IP);
const loginEmailLimiter = createRateLimiter(RATE_LIMITS.LOGIN_EMAIL, {
  keyGenerator: emailKey,
});
const registerIpLimiter = createRateLimiter(RATE_LIMITS.REGISTER_IP);
const resendVerificationIpLimiter = createRateLimiter(
  RATE_LIMITS.RESEND_VERIFICATION_IP,
);
const resendVerificationEmailLimiter = createRateLimiter(
  RATE_LIMITS.RESEND_VERIFICATION_EMAIL,
  { keyGenerator: emailKey },
);
const forgotPasswordIpLimiter = createRateLimiter(
  RATE_LIMITS.FORGOT_PASSWORD_IP,
);
const forgotPasswordEmailLimiter = createRateLimiter(
  RATE_LIMITS.FORGOT_PASSWORD_EMAIL,
  { keyGenerator: emailKey },
);
const emailVerificationLimiter = createRateLimiter(
  RATE_LIMITS.EMAIL_VERIFICATION_IP,
);
const passwordResetTokenLimiter = createRateLimiter(
  RATE_LIMITS.PASSWORD_RESET_TOKEN_IP,
);
const passwordResetLimiter = createRateLimiter(RATE_LIMITS.PASSWORD_RESET_IP);
const refreshTokenLimiter = createRateLimiter(RATE_LIMITS.REFRESH_TOKEN_IP);
const reportLimiter = createRateLimiter(RATE_LIMITS.REPORTS, {
  keyGenerator: userKey,
});

module.exports = {
  RATE_LIMITS,
  authenticatedUserLimiter,
  createRateLimiter,
  emailKey,
  emailVerificationLimiter,
  forgotPasswordEmailLimiter,
  forgotPasswordIpLimiter,
  generalIpLimiter,
  ipKey,
  loginEmailLimiter,
  loginIpLimiter,
  passwordResetLimiter,
  passwordResetTokenLimiter,
  refreshTokenLimiter,
  registerIpLimiter,
  reportLimiter,
  resendVerificationEmailLimiter,
  resendVerificationIpLimiter,
  userKey,
};
