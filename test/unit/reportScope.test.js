const {
  createAccountingCompanyWhere,
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

  it("adds the selected accounting companies without changing tenant scope", () => {
    const context = {
      mode: "authenticated",
      companyIds: ["account_1"],
      accountingCompanyIds: ["books_1", "books_2", "books_1"],
    };

    expect(createCompanyWhere(context)).toEqual({ companyId: "account_1" });
    expect(createAccountingCompanyWhere(context)).toEqual({
      accountingCompanyId: { in: ["books_1", "books_2"] },
    });
  });

  it("does not restrict accounting companies when no selection is supplied", () => {
    expect(
      createAccountingCompanyWhere({
        mode: "authenticated",
        companyIds: ["account_1"],
      }),
    ).toEqual({});
  });
});
