const { hashString } = require("../../utils/token.js");
const { apiKeyAuth } = require("../../middleware/apiKeyAuth.js");
const { findUserFromApi } = require("../../db/authQueries.js");

jest.mock("../../utils/token.js", () => ({
  hashString: jest.fn(),
}));

jest.mock("../../db/authQueries.js", () => ({
  findUserFromApi: jest.fn(),
}));

describe("apiKeyAuth middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      header: jest.fn(),
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  it("should return 401 if no api key is provided", async () => {
    req.header.mockReturnValue(undefined);

    await apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "No api key provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if api key is invalid", async () => {
    req.header.mockReturnValue("my-api-key");
    hashString.mockReturnValue("hashed-key");
    findUserFromApi.mockResolvedValue(null);

    await apiKeyAuth(req, res, next);

    expect(hashString).toHaveBeenCalledWith("my-api-key");
    expect(findUserFromApi).toHaveBeenCalledWith("hashed-key");

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid key",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next if api key is valid", async () => {
    req.header.mockReturnValue("my-api-key");
    hashString.mockReturnValue("hashed-key");
    findUserFromApi.mockResolvedValue({
      id: 1,
      name: "John",
    });

    await apiKeyAuth(req, res, next);

    expect(hashString).toHaveBeenCalledWith("my-api-key");
    expect(findUserFromApi).toHaveBeenCalledWith("hashed-key");

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 500 if an error occurs", async () => {
    req.header.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    await apiKeyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal Server Error",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
