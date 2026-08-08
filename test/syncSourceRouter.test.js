const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET_KEY = "test-secret";
process.env.JWT_ISSUER = "test-issuer";
process.env.JWT_AUDIENCE = "test-audience";
process.env.NODE_ENV = "test";

jest.mock("../db/authQueries", () => ({
  findUser: jest.fn(),
}));
jest.mock("../db/syncSourceQueries", () => ({
  getCompanySyncStatus: jest.fn(),
  provisionSyncSource: jest.fn(),
}));
jest.mock("../utils/syncApiKey", () => ({
  generateSyncApiKey: jest.fn(),
}));

const { findUser } = require("../db/authQueries");
const {
  getCompanySyncStatus,
  provisionSyncSource,
} = require("../db/syncSourceQueries");
const { generateSyncApiKey } = require("../utils/syncApiKey");
const app = require("../app");

const companyId = "123e4567-e89b-42d3-a456-426614174000";
const token = jwt.sign({ sub: "user_1" }, process.env.JWT_SECRET_KEY, {
  algorithm: "HS256",
  issuer: process.env.JWT_ISSUER,
  audience: process.env.JWT_AUDIENCE,
  expiresIn: "15m",
});

function postSyncSource(body = { name: "Main office PC" }) {
  return request(app)
    .post(`/api/v1/companies/${companyId}/sync-sources`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function getSyncSourceStatus() {
  return request(app)
    .get(`/api/v1/companies/${companyId}/sync-sources`)
    .set("Authorization", `Bearer ${token}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  findUser.mockResolvedValue({
    id: "user_1",
    email: "owner@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    emailVerified: true,
    companies: [],
  });
  generateSyncApiKey.mockReturnValue({
    apiKey: "sync_abc123.secret-value",
    keyPrefix: "sync_abc123",
    keyHash: "hashed-secret-value",
  });
});

describe("GET /api/v1/companies/:companyId/sync-sources", () => {
  it("requires a JWT", async () => {
    const response = await request(app).get(
      `/api/v1/companies/${companyId}/sync-sources`,
    );

    expect(response.status).toBe(401);
    expect(getCompanySyncStatus).not.toHaveBeenCalled();
  });

  it("rejects an invalid company ID", async () => {
    const response = await request(app)
      .get("/api/v1/companies/not-a-uuid/sync-sources")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.errors.companyId).toEqual([
      "Company ID must be a valid UUID",
    ]);
    expect(getCompanySyncStatus).not.toHaveBeenCalled();
  });

  it("returns an unconfigured status for a company without a source", async () => {
    getCompanySyncStatus.mockResolvedValue({
      status: "ok",
      configured: false,
      credentialStatus: "not_configured",
      canManage: true,
      syncSource: null,
      apiKey: null,
    });

    const response = await getSyncSourceStatus();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      configured: false,
      credentialStatus: "not_configured",
      canManage: true,
      syncSource: null,
      apiKey: null,
    });
    expect(getCompanySyncStatus).toHaveBeenCalledWith({
      companyId,
      userId: "user_1",
    });
  });

  it("returns active key metadata without its secret", async () => {
    getCompanySyncStatus.mockResolvedValue({
      status: "ok",
      configured: true,
      credentialStatus: "active",
      canManage: true,
      syncSource: {
        id: "source_1",
        name: "Main office PC",
        lastSyncedAt: null,
      },
      apiKey: {
        keyPrefix: "sync_existing",
        createdAt: new Date("2026-08-08T12:00:00.000Z"),
        expiresAt: new Date("2027-08-08T12:00:00.000Z"),
        lastUsedAt: null,
      },
    });

    const response = await getSyncSourceStatus();

    expect(response.status).toBe(200);
    expect(response.body.configured).toBe(true);
    expect(response.body.credentialStatus).toBe("active");
    expect(response.body.apiKey.keyPrefix).toBe("sync_existing");
    expect(response.body.apiKey).not.toHaveProperty("value");
  });

  it("does not reveal whether a company exists to a non-member", async () => {
    getCompanySyncStatus.mockResolvedValue({ status: "forbidden" });

    const response = await getSyncSourceStatus();

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("SYNC_SOURCE_FORBIDDEN");
  });
});

describe("POST /api/v1/companies/:companyId/sync-sources", () => {
  it("requires a JWT", async () => {
    const response = await request(app)
      .post(`/api/v1/companies/${companyId}/sync-sources`)
      .send({ name: "Main office PC" });

    expect(response.status).toBe(401);
    expect(provisionSyncSource).not.toHaveBeenCalled();
  });

  it("rejects an invalid company ID", async () => {
    const response = await request(app)
      .post("/api/v1/companies/not-a-uuid/sync-sources")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Main office PC" });

    expect(response.status).toBe(400);
    expect(response.body.errors.companyId).toEqual([
      "Company ID must be a valid UUID",
    ]);
    expect(provisionSyncSource).not.toHaveBeenCalled();
  });

  it("uses a default source name when the frontend sends no name", async () => {
    provisionSyncSource.mockResolvedValue({
      status: "created",
      syncSource: { id: "source_1", name: "Primary accounting source" },
      apiKey: {
        keyPrefix: "sync_abc123",
        createdAt: new Date("2026-08-08T12:00:00.000Z"),
        expiresAt: new Date("2027-08-08T12:00:00.000Z"),
      },
    });

    const response = await postSyncSource({});

    expect(response.status).toBe(201);
    expect(provisionSyncSource).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Primary accounting source" }),
    );
  });

  it("requires a verified email", async () => {
    findUser.mockResolvedValue({
      id: "user_1",
      emailVerified: false,
      companies: [],
    });

    const response = await postSyncSource();

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(generateSyncApiKey).not.toHaveBeenCalled();
    expect(provisionSyncSource).not.toHaveBeenCalled();
  });

  it("allows only company owners and admins", async () => {
    provisionSyncSource.mockResolvedValue({ status: "forbidden" });

    const response = await postSyncSource();

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("SYNC_SOURCE_FORBIDDEN");
  });

  it("returns the new plaintext key exactly once", async () => {
    provisionSyncSource.mockResolvedValue({
      status: "created",
      syncSource: { id: "source_1", name: "Main office PC" },
      apiKey: {
        keyPrefix: "sync_abc123",
        createdAt: new Date("2026-08-08T12:00:00.000Z"),
        expiresAt: new Date("2027-08-08T12:00:00.000Z"),
      },
    });

    const response = await postSyncSource();

    expect(response.status).toBe(201);
    expect(response.body.apiKey.value).toBe("sync_abc123.secret-value");
    expect(response.body.message).toMatch(/will not be displayed again/i);

    const databaseInput = provisionSyncSource.mock.calls[0][0];
    expect(databaseInput).toEqual(
      expect.objectContaining({
        companyId,
        userId: "user_1",
        name: "Main office PC",
        keyPrefix: "sync_abc123",
        keyHash: "hashed-secret-value",
      }),
    );
    expect(databaseInput).not.toHaveProperty("apiKey");
  });

  it("does not expose the existing secret when an active key exists", async () => {
    provisionSyncSource.mockResolvedValue({
      status: "exists",
      syncSource: { id: "source_1", name: "Main office PC" },
      apiKey: {
        keyPrefix: "sync_existing",
        createdAt: new Date("2026-08-08T12:00:00.000Z"),
        expiresAt: new Date("2027-08-08T12:00:00.000Z"),
      },
    });

    const response = await postSyncSource();

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("SYNC_API_KEY_EXISTS");
    expect(response.body.apiKey.keyPrefix).toBe("sync_existing");
    expect(response.body.apiKey).not.toHaveProperty("value");
  });
});
