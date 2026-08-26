const request = require("supertest");

jest.mock("../db/financialYearQueries", () => ({
  findAvailableAccountingCompanies: jest.fn(),
  findAvailableFinancialYears: jest.fn(),
}));

const {
  findAvailableAccountingCompanies,
  findAvailableFinancialYears,
} = require("../db/financialYearQueries");
const app = require("../app");

describe("GET /api/v1/reports/financial-years", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns only years available to the report context", async () => {
    findAvailableFinancialYears.mockResolvedValue([
      "2025-2026",
      "2026-2027",
    ]);

    const response = await request(app).get(
      "/api/v1/reports/financial-years",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: ["2025-2026", "2026-2027"],
    });
    expect(findAvailableFinancialYears).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "demo" }),
    );
  });
});

describe("GET /api/v1/reports/accounting-companies", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns accounting companies available to the report context", async () => {
    findAvailableAccountingCompanies.mockResolvedValue([
      {
        id: "company-books-1",
        name: "North Division",
        company: { name: "Owner Workspace" },
      },
      {
        id: "company-books-2",
        name: "South Division",
        company: { name: "Owner Workspace" },
      },
    ]);

    const response = await request(app).get(
      "/api/v1/reports/accounting-companies",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: "company-books-1",
          name: "North Division",
          accountName: "Owner Workspace",
        },
        {
          id: "company-books-2",
          name: "South Division",
          accountName: "Owner Workspace",
        },
      ],
    });
    expect(findAvailableAccountingCompanies).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "demo" }),
    );
  });
});
