const request = require("supertest");

jest.mock("../db/syncSourceQueries", () => ({
  authenticateSyncApiKey: jest.fn(),
  getCompanySyncStatus: jest.fn(),
  provisionSyncSource: jest.fn(),
}));
jest.mock("../db/accountingCompanyQueries", () => ({
  upsertAccountingCompanies: jest.fn(),
}));

const {
  authenticateSyncApiKey,
} = require("../db/syncSourceQueries");
const {
  upsertAccountingCompanies,
} = require("../db/accountingCompanyQueries");
const app = require("../app");

describe("POST /api/v1/sync/companies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticateSyncApiKey.mockResolvedValue({
      apiKeyId: "key_1",
      companyId: "account_1",
      syncSourceId: "source_1",
    });
  });

  it("requires a sync API key", async () => {
    const response = await request(app)
      .post("/api/v1/sync/companies")
      .send({
        companies: [
          { externalCompanyId: "GUID-1", name: "ABC Textiles" },
        ],
      });

    expect(response.status).toBe(401);
    expect(upsertAccountingCompanies).not.toHaveBeenCalled();
  });

  it("rejects duplicate external company IDs", async () => {
    const response = await request(app)
      .post("/api/v1/sync/companies")
      .set("Authorization", "Bearer sync_abc.secret")
      .send({
        companies: [
          { externalCompanyId: "GUID-1", name: "ABC Textiles" },
          { externalCompanyId: "GUID-1", name: "Renamed Company" },
        ],
      });

    expect(response.status).toBe(400);
    expect(
      response.body.errors["companies.1.externalCompanyId"],
    ).toEqual(["External company IDs must be unique"]);
    expect(upsertAccountingCompanies).not.toHaveBeenCalled();
  });

  it("uses the account and computer from the API key, not the body", async () => {
    upsertAccountingCompanies.mockResolvedValue([
      {
        id: "books_1",
        externalId: "GUID-1",
        name: "ABC Textiles",
        syncSourceId: "source_1",
      },
      {
        id: "books_2",
        externalId: "GUID-2",
        name: "XYZ Fabrics",
        syncSourceId: "source_1",
      },
    ]);

    const response = await request(app)
      .post("/api/v1/sync/companies")
      .set("Authorization", "Bearer sync_abc.secret")
      .send({
        companyId: "attacker-account",
        syncSourceId: "attacker-source",
        companies: [
          { externalCompanyId: " GUID-1 ", name: " ABC Textiles " },
          { externalCompanyId: "GUID-2", name: "XYZ Fabrics" },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(upsertAccountingCompanies).toHaveBeenCalledWith({
      companyId: "account_1",
      syncSourceId: "source_1",
      companies: [
        { externalCompanyId: "GUID-1", name: "ABC Textiles" },
        { externalCompanyId: "GUID-2", name: "XYZ Fabrics" },
      ],
    });
  });
});

