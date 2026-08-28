const request = require("supertest");

const app = require("../app");

describe("application deployment configuration", () => {
  const originalClientUrl = process.env.CLIENT_URL;
  const originalCorsOrigins = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (originalClientUrl === undefined) {
      delete process.env.CLIENT_URL;
    } else {
      process.env.CLIENT_URL = originalClientUrl;
    }

    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    }
  });

  test("exposes service metadata at the root", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: "dashboard-backend",
      status: "ok",
      apiBasePath: "/api/v1",
    });
  });

  test("exposes a health endpoint", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers.ratelimit).toBeUndefined();
  });

  test("allows the configured frontend origin with credentials", async () => {
    process.env.CLIENT_URL = "https://dashboard.example.com/";

    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "https://dashboard.example.com")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://dashboard.example.com",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  test("allows additional comma-separated frontend origins", async () => {
    process.env.CORS_ORIGINS =
      "https://preview.example.com, https://admin.example.com/path";

    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "https://admin.example.com")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://admin.example.com",
    );
  });

  test("does not grant CORS access to an unconfigured origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://untrusted.example.com");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
