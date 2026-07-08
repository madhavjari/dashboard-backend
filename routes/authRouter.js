const { Router } = require("express");
const authController = require("../controller/authController");
const { validate } = require("../middleware/zodValidator");
const { registerSchema, loginSchema } = require("../schema/validatorSchema");

const authRouter = Router();

authRouter.post(
  "/api/auth/register",
  validate(registerSchema),
  authController.postRegister,
);

authRouter.post(
  "/api/auth/login",
  validate(loginSchema),
  authController.postLogin,
);

authRouter.post("/api/auth/refresh", authController.postRefreshToken);

authRouter.post("/api/auth/logout", authController.postLogout);

module.exports = authRouter;
