const { z } = require("zod");

const { emailExists } = require("../db/authQueries");

const registerSchema = z.object({
  body: z
    .object({
      firstName: z
        .string()
        .min(2, "First Name must be at least 2 characters")
        .max(32, "First Name must be less than 32 characters"),
      lastName: z
        .string()
        .min(2, "First Name must be at least 2 characters")
        .max(32, "First Name must be less than 32 characters"),
      email: z
        .email({
          required_error: "Email is required.",
          invalid_type_error: "Email is invalid.",
        })
        .trim()
        .toLowerCase()
        .max(32, "Email must be less than 32 characters")
        .refine(
          async (email) => {
            const user = await emailExists(email);
            return !user;
          },
          { message: "Email already taken" },
        ),
      //         model User{
      //   id          String        @id @default(uuid())
      //   firstName   String
      //   lastName    String
      //   email       String        @unique
      //   phoneNumber String
      //   password    String
      //   createdAt   DateTime      @default(now())
      //   companies   CompanyUser[]
      //   apikey      Apikey?
      // }
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
      password: z
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
        }),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

const loginSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(1, "Username is required")
      .max(30, "Do no breach max length")
      .trim(),
    password: z
      .string()
      .min(1, "Password is require")
      .max(30, "Let's not enter too large password"),
  }),
});
module.exports = { registerSchema, loginSchema };
