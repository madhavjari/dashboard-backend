const { z } = require("zod");

const { findUser } = require("../db/authQueries");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(32, "Password must have less than 32 characters")
  .regex(/[A-Z]/, {
    message: "Password must contain at least one uppercase letter",
  })
  .regex(/[a-z]/, {
    message: "Password must contain at least one lowercase letter",
  })
  .regex(/[0-9]/, {
    message: "Password must contain at least one number",
  })
  .regex(/[^A-Za-z0-9]/, {
    message: "Password must contain at least one special character",
  });

const registerSchema = z.object({
  body: z
    .object({
      firstName: z
        .string()
        .min(2, "First Name must be at least 2 characters")
        .max(32, "First Name must be less than 32 characters"),
      lastName: z
        .string()
        .min(2, "Last Name must be at least 2 characters")
        .max(32, "Last Name must be less than 32 characters"),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .min(1, "Email is Required.")
        .max(100, "Email must be less than 100 characters")
        .pipe(z.email("Email is invalid"))
        .refine(
          async (email) => {
            const user = await findUser(["id"], { email: email });
            return !user;
          },
          { message: "Email already taken" },
        ),
      companyName: z
        .string()
        .trim()
        .min(2, "Username must be at least 2 characters long")
        .max(32, "Username must have less than 32 characters"),
      phoneNumber: z
        .string()
        .trim()
        .regex(/^\+91\d{10}$/, {
          message:
            "Security alert: Must be a valid +91 country code followed by 10 digits.",
        })
        .pipe(z.e164()),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email is Required.")
      .max(100, "Email must be less than 100 characters")
      .pipe(z.email("Email is invalid")),
    password: z
      .string()
      .min(1, "Password is require")
      .max(32, "Let's not enter too large password"),
  }),
});

const passwordResetSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, "Token is required."),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

const emailSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, "Email is required")
      .max(100, "Email must be less than 100 characters")
      .trim()
      .toLowerCase()
      .pipe(z.email()),
  }),
});

const tokenSchema = z.object({
  query: z.object({
    token: z.string().min(1, "Token is required"),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  emailSchema,
  passwordResetSchema,
  tokenSchema,
};
