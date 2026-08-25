const request = require("supertest");

jest.mock("../db/financialYearQueries", () => ({
  findAvailableFinancialYears: jest.fn(),
}));

const {
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
