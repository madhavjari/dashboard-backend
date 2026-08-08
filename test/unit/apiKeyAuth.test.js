const { hashString } = require("../../utils/token");
const { syncApiKeyAuth } = require("../../middleware/apiKeyAuth");
const { authenticateSyncApiKey } = require("../../db/syncSourceQueries");

jest.mock("../../utils/token", () => ({
  hashString: jest.fn(),
}));

jest.mock("../../db/syncSourceQueries", () => ({
  authenticateSyncApiKey: jest.fn(),
}));

describe("syncApiKeyAuth middleware", () => {
  let headers;
  let req;
  let res;
  let next;

  beforeEach(() => {
    headers = {};
    req = {
      get: jest.fn((name) => headers[name.toLowerCase()]),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("returns 401 when no sync API key is provided", async () => {
    await syncApiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      code: "SYNC_API_KEY_REQUIRED",
      message: "Sync API key is required.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("authenticates a Bearer sync API key", async () => {
    headers.authorization = "Bearer sync_abc.secret";
    hashString.mockReturnValue("hashed-key");
    authenticateSyncApiKey.mockResolvedValue({
      apiKeyId: "key_1",
      companyId: "company_1",
      syncSourceId: "source_1",
    });

    await syncApiKeyAuth(req, res, next);

    expect(hashString).toHaveBeenCalledWith("sync_abc.secret");
    expect(authenticateSyncApiKey).toHaveBeenCalledWith("hashed-key");
    expect(req.syncAuth).toEqual({
      apiKeyId: "key_1",
      companyId: "company_1",
      syncSourceId: "source_1",
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("temporarily supports the x-api-key header", async () => {
    headers["x-api-key"] = "sync_legacy.secret";
    hashString.mockReturnValue("hashed-key");
    authenticateSyncApiKey.mockResolvedValue({
      apiKeyId: "key_1",
      companyId: "company_1",
      syncSourceId: "source_1",
    });

    await syncApiKeyAuth(req, res, next);

    expect(hashString).toHaveBeenCalledWith("sync_legacy.secret");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns a generic 401 for an invalid, expired, or revoked key", async () => {
    headers.authorization = "Bearer invalid-key";
    hashString.mockReturnValue("invalid-hash");
    authenticateSyncApiKey.mockResolvedValue(null);

    await syncApiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      code: "INVALID_SYNC_API_KEY",
      message: "Invalid or inactive sync API key.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 when authentication fails unexpectedly", async () => {
    headers.authorization = "Bearer sync_abc.secret";
    hashString.mockReturnValue("hashed-key");
    authenticateSyncApiKey.mockRejectedValue(new Error("database unavailable"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    await syncApiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal Server Error",
    });
    expect(next).not.toHaveBeenCalled();
    console.error.mockRestore();
  });
});
