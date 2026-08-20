const {
  getReportCompanyIds,
  createCompanyWhere,
} = require("../../db/reportScope");

describe("reportScope", () => {
  it("scopes demo reports to the configured demo company", () => {
    const context = { mode: "demo", companyId: "demo_1" };

    expect(getReportCompanyIds(context)).toEqual(["demo_1"]);
    expect(createCompanyWhere(context)).toEqual({ companyId: "demo_1" });
  });

  it("deduplicates authenticated membership company IDs", () => {
    const context = {
      mode: "authenticated",
      companyIds: ["company_1", "company_1", "company_2"],
    };

    expect(getReportCompanyIds(context)).toEqual([
      "company_1",
      "company_2",
    ]);
    expect(createCompanyWhere(context)).toEqual({
      companyId: { in: ["company_1", "company_2"] },
    });
  });

  it("uses an empty company filter when no trusted context exists", () => {
    expect(createCompanyWhere(undefined)).toEqual({
      companyId: { in: [] },
    });
  });
});
