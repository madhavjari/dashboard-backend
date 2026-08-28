const express = require("express");
const request = require("supertest");
const {
  createRateLimiter,
  emailKey,
  userKey,
} = require("../../middleware/rateLimiter");

function createTestApp({ limiter, authenticate, method = "get" }) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app[method](
    "/resource",
    ...(authenticate ? [authenticate] : []),
    limiter,
    (_req, res) => res.status(200).json({ ok: true }),
  );
  return app;
}

function testPolicy(identifier, limit = 2) {
  return { windowMs: 60 * 1000, limit, identifier };
}

describe("rate limiter middleware", () => {
  test("IP buckets are isolated and excessive requests receive standard headers", async () => {
    const limiter = createRateLimiter(testPolicy("test-ip"));
    const app = createTestApp({ limiter });

    const first = await request(app)
      .get("/resource")
      .set("X-Forwarded-For", "203.0.113.10");
    const second = await request(app)
      .get("/resource")
      .set("X-Forwarded-For", "203.0.113.10");
    const exceeded = await request(app)
      .get("/resource")
      .set("X-Forwarded-For", "203.0.113.10");
    const otherIp = await request(app)
      .get("/resource")
      .set("X-Forwarded-For", "203.0.113.11");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(exceeded.status).toBe(429);
    expect(exceeded.body).toEqual({
      message: "Too many requests. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
    expect(exceeded.headers.ratelimit).toBeDefined();
    expect(exceeded.headers["retry-after"]).toBeDefined();
    expect(exceeded.headers["x-ratelimit-limit"]).toBeUndefined();
    expect(otherIp.status).toBe(200);
  });

  test("authenticated users have separate buckets after authentication", async () => {
    const limiter = createRateLimiter(testPolicy("test-user"), {
      keyGenerator: userKey,
    });
    const authenticate = (req, res, next) => {
      const userId = req.get("X-Test-User");
      if (!userId) {
        return res.status(401).json({ message: "Required: Sign in" });
      }
      req.user = { id: userId };
      return next();
    };
    const app = createTestApp({ limiter, authenticate });

    const first = await request(app)
      .get("/resource")
      .set("X-Test-User", "user_1")
      .set("X-Forwarded-For", "203.0.113.20");
    const second = await request(app)
      .get("/resource")
      .set("X-Test-User", "user_1")
      .set("X-Forwarded-For", "203.0.113.21");
    const exceeded = await request(app)
      .get("/resource")
      .set("X-Test-User", "user_1")
      .set("X-Forwarded-For", "203.0.113.22");
    const otherUser = await request(app)
      .get("/resource")
      .set("X-Test-User", "user_2")
      .set("X-Forwarded-For", "203.0.113.20");
    const unauthenticated = await request(app).get("/resource");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(exceeded.status).toBe(429);
    expect(otherUser.status).toBe(200);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.ratelimit).toBeUndefined();
  });

  test("email keys normalize case and missing emails fall back to IP", async () => {
    const limiter = createRateLimiter(testPolicy("test-email", 1), {
      keyGenerator: emailKey,
    });
    const app = createTestApp({ limiter, method: "post" });

    const firstEmail = await request(app)
      .post("/resource")
      .set("X-Forwarded-For", "203.0.113.30")
      .send({ email: "  Ada@Example.COM " });
    const normalizedEmail = await request(app)
      .post("/resource")
      .set("X-Forwarded-For", "203.0.113.31")
      .send({ email: "ada@example.com" });
    const firstMissing = await request(app)
      .post("/resource")
      .set("X-Forwarded-For", "203.0.113.40")
      .send({});
    const repeatedMissing = await request(app)
      .post("/resource")
      .set("X-Forwarded-For", "203.0.113.40")
      .send({});
    const otherMissingIp = await request(app)
      .post("/resource")
      .set("X-Forwarded-For", "203.0.113.41")
      .send({});

    expect(firstEmail.status).toBe(200);
    expect(normalizedEmail.status).toBe(429);
    expect(firstMissing.status).toBe(200);
    expect(repeatedMissing.status).toBe(429);
    expect(otherMissingIp.status).toBe(200);
  });
});
