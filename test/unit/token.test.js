describe("token utils", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      JWT_SECRET_KEY: "test-secret",
      JWT_ISSUER: "test-issuer",
      JWT_AUDIENCE: "test-audience",
      NODE_ENV: "test",
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe("getAccessToken", () => {
    test("returns a valid JWT signed with the correct payload", () => {
      const { getAccessToken } = require("../../utils/token");
      const jwt = require("jsonwebtoken");

      const token = getAccessToken("user-123");
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, {
        algorithms: ["HS256"],
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      });

      expect(decoded.sub).toBe("user-123");
    });

    test("sets an expiry roughly 15 minutes in the future", () => {
      const { getAccessToken } = require("../../utils/token");
      const jwt = require("jsonwebtoken");

      const token = getAccessToken("user-123");
      const decoded = jwt.decode(token);

      const expectedExp = Math.floor(Date.now() / 1000) + 15 * 60;
      expect(decoded.exp).toBeGreaterThan(expectedExp - 5);
      expect(decoded.exp).toBeLessThan(expectedExp + 5);
    });

    test("throws if JWT_SECRET_KEY is missing", () => {
      process.env.JWT_SECRET_KEY = "";
      const { getAccessToken } = require("../../utils/token");
      expect(() => getAccessToken("user-123")).toThrow();
    });

    test("produces a token that fails verification with the wrong secret", () => {
      const { getAccessToken } = require("../../utils/token");
      const jwt = require("jsonwebtoken");

      const token = getAccessToken("user-123");
      expect(() => jwt.verify(token, "wrong-secret")).toThrow();
    });

    test("produces a token that fails verification with the wrong issuer/audience", () => {
      const { getAccessToken } = require("../../utils/token");
      const jwt = require("jsonwebtoken");

      const token = getAccessToken("user-123");
      expect(() =>
        jwt.verify(token, process.env.JWT_SECRET_KEY, {
          issuer: "someone-else",
          audience: process.env.JWT_AUDIENCE,
        }),
      ).toThrow();
    });
  });

  describe("hashString", () => {
    test("produces a deterministic SHA-256 hex hash", () => {
      const { hashString } = require("../../utils/token");
      const crypto = require("node:crypto");

      const expected = crypto
        .createHash("sha256")
        .update("hello")
        .digest("hex");

      expect(hashString("hello")).toBe(expected);
    });

    test("same input always produces the same hash", () => {
      const { hashString } = require("../../utils/token");
      expect(hashString("abc")).toBe(hashString("abc"));
    });

    test("different inputs produce different hashes", () => {
      const { hashString } = require("../../utils/token");
      expect(hashString("abc")).not.toBe(hashString("abd"));
    });
  });

  describe("generateToken", () => {
    test("returns a token and its matching hash", () => {
      const { generateToken, hashString } = require("../../utils/token");
      const { token, tokenHash } = generateToken();

      expect(typeof token).toBe("string");
      expect(tokenHash).toBe(hashString(token));
    });

    test("token is a 128-character hex string (64 random bytes)", () => {
      const { generateToken } = require("../../utils/token");
      const { token } = generateToken();

      expect(token).toMatch(/^[0-9a-f]{128}$/);
    });

    test("generates unique tokens on each call", () => {
      const { generateToken } = require("../../utils/token");
      const first = generateToken();
      const second = generateToken();

      expect(first.token).not.toBe(second.token);
      expect(first.tokenHash).not.toBe(second.tokenHash);
    });
  });

  describe("generatedRefreshToken", () => {
    test("returns a refresh token and its matching hash", () => {
      const {
        generatedRefreshToken,
        hashString,
      } = require("../../utils/token");
      const { refreshToken, refreshTokenHash } = generatedRefreshToken();

      expect(typeof refreshToken).toBe("string");
      expect(refreshTokenHash).toBe(hashString(refreshToken));
    });

    test("generates unique refresh tokens on each call", () => {
      const { generatedRefreshToken } = require("../../utils/token");
      const first = generatedRefreshToken();
      const second = generatedRefreshToken();

      expect(first.refreshToken).not.toBe(second.refreshToken);
    });
  });

  describe("refreshExpiry", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("returns a Date 30 days in the future", () => {
      const { refreshExpiry } = require("../../utils/token");
      const result = refreshExpiry();

      const expected = new Date("2026-01-31T00:00:00Z");
      expect(result.getTime()).toBe(expected.getTime());
    });

    test("returns a Date instance", () => {
      const { refreshExpiry } = require("../../utils/token");
      expect(refreshExpiry()).toBeInstanceOf(Date);
    });
  });

  describe("refreshCookieOptions", () => {
    test("has the correct static properties in non-production", () => {
      process.env.NODE_ENV = "development";
      const { refreshCookieOptions } = require("../../utils/token");

      expect(refreshCookieOptions).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/auth",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    });

    test("uses secure cookies and sameSite=none in production", () => {
      process.env.NODE_ENV = "production";
      const { refreshCookieOptions } = require("../../utils/token");

      expect(refreshCookieOptions.secure).toBe(true);
      expect(refreshCookieOptions.sameSite).toBe("none");
    });

    test("maxAge equals 30 days in milliseconds", () => {
      const { refreshCookieOptions } = require("../../utils/token");
      expect(refreshCookieOptions.maxAge).toBe(2592000000);
    });
  });
});
