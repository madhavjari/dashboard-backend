const { z } = require("zod");

const { findUser, findEmail } = require("../db/queries");

const registerSchema = z.object({
  body: z
    .object({
      firstName: z
        .string()
        .min(2, "First Name must be at least 2 characters")
        .max(30, "First Name must be less than 30 characters"),
      lastName: z
        .string()
        .min(2, "First Name must be at least 2 characters")
        .max(30, "First Name must be less than 30 characters"),
      email: z
        .email("Invalid Email Format")
        .trim()
        .toLowerCase()
        .max(30, "Email must be less than 30 characters")
        .refine(
          async (email) => {
            const user = await findEmail(email);
            return !user;
          },
          { message: "Email already taken" },
        ),
      username: z
        .string()
        .trim()
        .min(5, "Username must be at least 5 characters long")
        .max(30, "Username must have less than 30 characters")
        .refine(
          async (username) => {
            const user = await findUser(username);
            return !user;
          },
          { message: "username already taken" },
        ),
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

const postSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").trim(),
    content: z.string().min(1, "Content is required").trim(),
  }),
});

const commentSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Content is required").trim(),
  }),
});
module.exports = { registerSchema, loginSchema, postSchema, commentSchema };
