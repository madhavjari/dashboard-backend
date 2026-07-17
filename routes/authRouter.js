const { Router } = require("express");
const authController = require("../controllers/authController");
const { validate } = require("../middleware/zodValidator");
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
  validate(registerSchema),
  authController.postRegister,
);

authRouter.post(
  "/api/v1/auth/login",
  validate(loginSchema),
  authController.postLogin,
);

authRouter.post(
  "/api/v1/auth/verify-email",
  validate(tokenSchema),
  authController.postVerifyEmail,
);

authRouter.post(
  "/api/v1/auth/resend-verification",
  validate(emailSchema),
  authController.postResendVerification,
);

authRouter.post(
  "/api/v1/auth/forgot-password",
  validate(emailSchema),
  authController.postForgotPassword,
);

authRouter.post(
  "/api/v1/auth/verify-password-reset-token",
  validate(tokenSchema),
  authController.postVerifyPasswordResetToken,
);

authRouter.post(
  "/api/v1/auth/reset-password",
  validate(passwordResetSchema),
  authController.postResetPassword,
);

authRouter.post("/api/v1/auth/refresh", authController.postRefreshToken);

authRouter.post("/api/v1/auth/logout", authController.postLogout);

module.exports = authRouter;
