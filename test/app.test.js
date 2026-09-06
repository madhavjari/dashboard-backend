const request = require("supertest");

const originalClientUrl = process.env.CLIENT_URL;
process.env.CLIENT_URL = "https://dashboard.example.com";
const app = require("../app");

describe("application deployment configuration", () => {
  afterAll(() => {
    if (originalClientUrl === undefined) {
      delete process.env.CLIENT_URL;
    } else {
      process.env.CLIENT_URL = originalClientUrl;
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

  test("returns the configured CORS origin for requests without a match", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://untrusted.example.com");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://dashboard.example.com",
    );
  });
});
