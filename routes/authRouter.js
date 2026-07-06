const { Router } = require("express");
const authController = require("../controller/authController");
const { validate } = require("../middleware/zodValidator");
const { registerSchema } = require("../schema/validatorSchema");

const authRouter = Router();

authRouter.post(
  "/api/auth/register",
  validate(registerSchema),
  authController.postRegister,
);

module.exports = authRouter;
