const { Router } = require("express");
const authController = require("../controllers/authController");
const { validate } = require("../middleware/zodValidator");
const verifyToken = require("../middleware/verifyToken");
const {
  authenticatedUserLimiter,
  emailVerificationLimiter,
  forgotPasswordEmailLimiter,
  forgotPasswordIpLimiter,
  loginEmailLimiter,
  loginIpLimiter,
  passwordResetLimiter,
  passwordResetTokenLimiter,
  refreshTokenLimiter,
  registerIpLimiter,
  resendVerificationEmailLimiter,
  resendVerificationIpLimiter,
} = require("../middleware/rateLimiter");
const {
  registerSchema,
  loginSchema,
  emailSchema,
  passwordResetSchema,
  tokenSchema,
} = require("../schema/validatorSchema");

const authRouter = Router();

authRouter.post(
  "/api/v1/auth/register",
  registerIpLimiter,
  validate(registerSchema),
  authController.postRegister,
);

authRouter.post(
  "/api/v1/auth/login",
  loginIpLimiter,
  loginEmailLimiter,
  validate(loginSchema),
  authController.postLogin,
);

authRouter.get(
  "/api/v1/auth/me",
  verifyToken,
  authenticatedUserLimiter,
  authController.getCurrentUser,
);

authRouter.post(
  "/api/v1/auth/verify-email",
  emailVerificationLimiter,
  validate(tokenSchema),
  authController.postVerifyEmail,
);

authRouter.post(
  "/api/v1/auth/resend-verification",
  resendVerificationIpLimiter,
  resendVerificationEmailLimiter,
  validate(emailSchema),
  authController.postResendVerification,
);

authRouter.post(
  "/api/v1/auth/forgot-password",
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  validate(emailSchema),
  authController.postForgotPassword,
);

authRouter.post(
  "/api/v1/auth/verify-password-reset-token",
  passwordResetTokenLimiter,
  validate(tokenSchema),
  authController.postVerifyPasswordResetToken,
);

authRouter.post(
  "/api/v1/auth/reset-password",
  passwordResetLimiter,
  validate(passwordResetSchema),
  authController.postResetPassword,
);

authRouter.post(
  "/api/v1/auth/refresh",
  refreshTokenLimiter,
  authController.postRefreshToken,
);

authRouter.post("/api/v1/auth/logout", authController.postLogout);

module.exports = authRouter;
