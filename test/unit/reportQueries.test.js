jest.mock("../../lib/prisma.js", () => ({
  prisma: {
    billEntry: {
      aggregate: jest.fn(),
    },
  },
}));

const { prisma } = require("../../lib/prisma.js");
const { findKpiData } = require("../../db/reportQueries");

describe("reportQueries tenant isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.billEntry.aggregate.mockResolvedValue({
      _sum: {
        netAmount: null,
        cgst: null,
        sgst: null,
        igst: null,
      },
      _count: { entryId: 0 },
    });
  });

  it("applies authenticated company IDs to every KPI aggregate", async () => {
    const context = {
      mode: "authenticated",
      companyIds: ["company_1", "company_2"],
      accountingCompanyIds: ["books_1", "books_2"],
    };

    await findKpiData(
      context,
      "2025-04-01",
      "2026-04-01",
      ["S"],
      ["SR"],
    );

    expect(prisma.billEntry.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: { in: ["company_1", "company_2"] },
          accountingCompanyId: { in: ["books_1", "books_2"] },
          financialYear: "2025-2026",
          isOpening: false,
          code: { in: ["S"] },
        }),
      }),
    );
    expect(prisma.billEntry.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: { in: ["company_1", "company_2"] },
          accountingCompanyId: { in: ["books_1", "books_2"] },
          financialYear: "2025-2026",
          isOpening: false,
          code: { in: ["SR"] },
        }),
      }),
    );
  });
});
