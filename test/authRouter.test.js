const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");

process.env.JWT_SECRET_KEY = "test-secret";
process.env.JWT_ISSUER = "test-issuer";
process.env.JWT_AUDIENCE = "test-audience";
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.EMAIL_FROM = "noreply@test.com";
process.env.RESEND_API_KEY = "test-key";

jest.mock("../db/authQueries");
jest.mock("../services/email");
jest.mock("../utils/sendWithRetry", () => ({
  sendWithRetry: jest.fn((fn) => fn()),
}));
jest.mock("argon2");

const argon2 = require("argon2");
const db = require("../db/authQueries");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../services/email");
const authRouter = require("../routes/authRouter");
const { hashString } = require("../utils/token");

const app = require("../app");
const validRegisterBody = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phoneNumber: "+919876543210",
  companyName: "Analytical Engines",
  password: "Str0ng!Pass",
  confirmPassword: "Str0ng!Pass",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  it("registers successfully with a valid, unique payload", async () => {
    db.findUser.mockResolvedValue(null); // used by schema refine (email uniqueness)
    db.createCompanyAndUser.mockResolvedValue({ newUser: { id: "user_1" } });
    db.createEmailVerification.mockResolvedValue(true);
    sendVerificationEmail.mockResolvedValue({ id: "email_1" });
    argon2.hash.mockResolvedValue("hashed_pw");

    const res = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody);

    expect(res.status).toBe(201);
    expect(db.createCompanyAndUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        hashedPassword: "hashed_pw",
      }),
    );
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      "ada@example.com",
      expect.any(String),
    );
  });

  it("returns 400 with per-field errors on an invalid payload", async () => {
    const res = await request(app).post("/api/auth/register").send({
      firstName: "A", // too short
      lastName: "Lovelace",
      email: "not-an-email",
      phoneNumber: "12345",
      companyName: "A",
      password: "weak",
      confirmPassword: "different",
    });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("fail");
    // Locks in the validate middleware fix: distinct keys per field, not one blob under "body"
    expect(Object.keys(res.body.errors)).toEqual(
      expect.arrayContaining([
        "firstName",
        "email",
        "phoneNumber",
        "companyName",
        "password",
      ]),
    );
    expect(db.createCompanyAndUser).not.toHaveBeenCalled();
  });

  it("returns 400 (schema-level) when email is already registered", async () => {
    db.findUser.mockResolvedValue({ id: "existing_user" }); // refine sees a match

    const res = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody);

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toEqual(
      expect.arrayContaining([expect.stringContaining("already taken")]),
    );
    expect(db.createCompanyAndUser).not.toHaveBeenCalled();
  });

  it("returns 400 when passwords don't match", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, confirmPassword: "Different1!" });

    expect(res.status).toBe(400);
    expect(res.body.errors.confirmPassword).toEqual(
      expect.arrayContaining([expect.stringContaining("do not match")]),
    );
  });

  it("returns 409 on a DB-level unique constraint race (P2002)", async () => {
    db.findUser.mockResolvedValue(null); // passes schema check
    const err = new Error("unique violation");
    err.code = "P2002";
    db.createCompanyAndUser.mockRejectedValue(err);
    argon2.hash.mockResolvedValue("hashed_pw");

    const res = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already taken/i);
  });

  it("still returns 201 if the verification email fails to send", async () => {
    db.findUser.mockResolvedValue(null);
    db.createCompanyAndUser.mockResolvedValue({ newUser: { id: "user_1" } });
    db.createEmailVerification.mockResolvedValue(true);
    argon2.hash.mockResolvedValue("hashed_pw");
    sendVerificationEmail.mockRejectedValue(new Error("resend down"));

    const res = await request(app)
      .post("/api/auth/register")
      .send(validRegisterBody);

    expect(res.status).toBe(201);
  });
});

describe("POST /api/auth/login", () => {
  const creds = { email: "ada@example.com", password: "Str0ng!Pass" };

  it("logs in successfully: 200, accessToken in body, refresh cookie set", async () => {
    db.findUser.mockResolvedValue({
      id: "user_1",
      email: "ada@example.com",
      password: "hashed_pw",
      emailVerified: true,
    });
    argon2.verify.mockResolvedValue(true);
    db.createRefreshToken.mockResolvedValue(true);

    const res = await request(app).post("/api/auth/login").send(creds);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.isVerified).toBe(true);

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/refresh_token=/);
    expect(cookies[0]).toMatch(/HttpOnly/);
    expect(cookies[0]).toMatch(/Path=\/api\/auth/);
  });

  it("returns 401 with a generic message when the user doesn't exist", async () => {
    db.findUser.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send(creds);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("returns 401 with the same generic shape on a wrong password", async () => {
    db.findUser.mockResolvedValue({
      id: "user_1",
      email: "ada@example.com",
      password: "hashed_pw",
      emailVerified: true,
    });
    argon2.verify.mockResolvedValue(false);

    const res = await request(app).post("/api/auth/login").send(creds);
    const notFoundRes = await request(app)
      .post("/api/auth/login")
      .send({ ...creds, email: "nobody@example.com" });

    expect(res.status).toBe(401);
    expect(notFoundRes.status).toBe(401);
    // Enumeration hygiene: identical response body/shape either way
    expect(res.body).toEqual(notFoundRes.body);
  });

  it("returns 400 on malformed login payload", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "bad", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("email");
    expect(res.body.errors).toHaveProperty("password");
  });
});

describe("POST /api/auth/verify-email", () => {
  it("returns 400 when token is missing", async () => {
    const res = await request(app).post("/api/auth/verify-email").send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid/unknown token", async () => {
    db.findVerificationToken.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "bogus" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid token/i);
  });

  it("returns 400 for an expired token", async () => {
    db.findVerificationToken.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "expired" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("returns 200 and consumes the token on success", async () => {
    const verification = { expiresAt: new Date(Date.now() + 1000 * 60) };
    db.findVerificationToken.mockResolvedValue(verification);
    db.updateAndDeleteVerificationToken.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "good-token" });

    expect(res.status).toBe(200);
    expect(db.updateAndDeleteVerificationToken).toHaveBeenCalledWith(
      verification,
    );
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("returns 400 on invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("email");
  });

  it("returns generic 200 without sending email when user doesn't exist", async () => {
    db.findUser.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "ghost@example.com" });

    expect(res.status).toBe(200);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns generic 200 without sending email when user is already verified", async () => {
    db.findUser.mockResolvedValue({ id: "user_1", emailVerified: true });
    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "ada@example.com" });

    expect(res.status).toBe(200);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends a new verification email for an unverified user", async () => {
    db.findUser.mockResolvedValue({ id: "user_1", emailVerified: false });
    db.deleteVerificationToken.mockResolvedValue(true);
    db.createEmailVerification.mockResolvedValue(true);
    sendVerificationEmail.mockResolvedValue({ id: "email_1" });

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "ada@example.com" });

    expect(res.status).toBe(200);
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      "ada@example.com",
      expect.any(String),
    );
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns 400 on invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nope" });
    expect(res.status).toBe(400);
  });

  it("returns generic 200 without sending email when user doesn't exist", async () => {
    db.findUser.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ghost@example.com" });

    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("sends a reset email when user exists", async () => {
    db.findUser.mockResolvedValue({ id: "user_1" });
    db.deletePasswordToken.mockResolvedValue(true);
    db.createPasswordReset.mockResolvedValue(true);
    sendPasswordResetEmail.mockResolvedValue({ id: "email_2" });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ada@example.com" });

    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "ada@example.com",
      expect.any(String),
    );
  });
});

describe("POST /api/auth/reset-password", () => {
  const validBody = {
    token: "reset-token",
    password: "N3wStr0ng!",
    confirmPassword: "N3wStr0ng!",
  };

  it("returns 400 when passwords don't match / fail complexity", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "t", password: "weak", confirmPassword: "weak" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("password");
  });

  it("returns 400 for an invalid/unknown reset token", async () => {
    db.findPasswordResetToken.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid token/i);
  });

  it("returns 400 for an expired reset token", async () => {
    db.findPasswordResetToken.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("returns 200 and updates the password on success", async () => {
    const reset = { expiresAt: new Date(Date.now() + 60000) };
    db.findPasswordResetToken.mockResolvedValue(reset);
    db.updateAndDeletePasswordResetToken.mockResolvedValue(true);
    argon2.hash.mockResolvedValue("new_hashed_pw");

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send(validBody);

    expect(res.status).toBe(200);
    expect(db.updateAndDeletePasswordResetToken).toHaveBeenCalledWith(
      reset,
      "new_hashed_pw",
    );
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns 401 when there is no refresh cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown/invalid refresh token", async () => {
    db.findRefreshToken.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refresh_token=garbage");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired refresh token", async () => {
    db.findRefreshToken.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      revoked: false,
      used: false,
    });
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refresh_token=expired");
    expect(res.status).toBe(401);
  });

  it("detects reuse of an already-used refresh token and revokes the family", async () => {
    db.findRefreshToken.mockResolvedValue({
      id: "rt_1",
      family: "family_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60000),
      revoked: false,
      used: true,
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refresh_token=reused");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/reuse detected/i);
    expect(db.updateTokenStatus).toHaveBeenCalledWith({
      family: "family_1",
      revoked: true,
    });
  });

  it("rotates the token and returns a new access token on success", async () => {
    db.findRefreshToken.mockResolvedValue({
      id: "rt_1",
      family: "family_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 60000),
      revoked: false,
      used: false,
    });
    db.rotateRefreshToken.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refresh_token=valid_token");

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.headers["set-cookie"][0]).toMatch(/refresh_token=/);
    expect(db.rotateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "rt_1",
        userId: "user_1",
        family: "family_1",
      }),
    );
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 204 and revokes the token when a refresh cookie is present", async () => {
    db.updateTokenStatus.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", "refresh_token=some_token");

    expect(res.status).toBe(204);
    expect(db.updateTokenStatus).toHaveBeenCalledWith({
      tokenHash: hashString("some_token"),
      revoked: true,
    });
    expect(res.headers["set-cookie"][0]).toMatch(/refresh_token=;/); // cleared
  });

  it("returns 204 without error when there is no refresh cookie", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(db.updateTokenStatus).not.toHaveBeenCalled();
  });
});
