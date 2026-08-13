jest.mock("../../db/reportQueries.js", () => ({
  findItemSummaryData: jest.fn(),
  findKpiData: jest.fn(),
  findMonthlyReportRows: jest.fn(),
  findPartySummaryRows: jest.fn(),
  findPartyTransactions: jest.fn(),
  findItemTransactions: jest.fn(),
}));

const reportQueries = require("../../db/reportQueries.js");
const reportService = require("../../services/reportService.js");

describe("reportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("calculates KPI values from raw aggregates", async () => {
    reportQueries.findKpiData.mockResolvedValue({
      bills: {
        _sum: {
          net_amount: "1250.50",
          cgst: "20",
          sgst: "20",
          igst: null,
        },
        _count: { entry_id: 3 },
      },
      returns: {
        _sum: {
          net_amount: "250.50",
          cgst: "5",
          sgst: "5",
          igst: "2",
        },
        _count: { entry_id: 1 },
      },
    });

    await expect(
      reportService.getKPI("2025-04-01", "2026-04-01", ["S"], ["SR"]),
    ).resolves.toEqual({
      grossAmount: 1250.5,
      returns: 250.5,
      netAmount: 1000,
      invoiceCount: 3,
      returnCount: 1,
      cgst: 20,
      igst: 0,
      sgst: 20,
      cgstReturn: 5,
      sgstReturn: 5,
      igstReturn: 2,
    });
  });

  test("maps item aggregates into the public report shape", async () => {
    reportQueries.findItemSummaryData.mockResolvedValue({
      summary: {
        _sum: {
          pcs: 12,
          meters: null,
          weight: 7,
          taxable: 900,
          final_amount: 1062,
        },
      },
      uniqueItems: [{ item_name: "COTTON" }, { item_name: "SILK" }],
      topItems: [
        {
          item_name: "COTTON",
          per: "MTR",
          _sum: {
            pcs: 10,
            meters: 50,
            weight: null,
            final_amount: 1000,
          },
        },
      ],
      returnItems: [
        {
          item_name: "SILK",
          per: "PCS",
          _sum: {
            pcs: 2,
            meters: null,
            weight: 1,
            final_amount: 100,
          },
        },
      ],
    });

    await expect(
      reportService.getItemWiseSummary(
        "2025-04-01",
        "2026-04-01",
        ["S"],
        ["SR"],
      ),
    ).resolves.toEqual({
      summary: {
        totalPcs: 12,
        totalMeters: 0,
        totalWeight: 7,
        totalTaxable: 900,
        totalTransaction: 1062,
        totalUniqueItems: 2,
      },
      topItems: [
        {
          itemName: "COTTON",
          pcs: 10,
          meters: 50,
          weight: 0,
          per: "MTR",
          transaction: 1000,
        },
      ],
      returnItems: [
        {
          itemName: "SILK",
          pcs: 2,
          meters: 0,
          weight: 1,
          per: "PCS",
          transaction: 100,
        },
      ],
    });
  });

  test("calculates monthly net amounts", async () => {
    const month = new Date("2025-04-01");
    reportQueries.findMonthlyReportRows.mockResolvedValue([
      {
        month,
        gross_amount: "1500",
        return_amount: "250",
      },
    ]);

    await expect(
      reportService.getMonthlySales(
        "2025-04-01",
        "2026-04-01",
        ["S"],
        ["SR"],
      ),
    ).resolves.toEqual([
      {
        month,
        grossAmount: 1500,
        returnAmount: 250,
        netAmount: 1250,
      },
    ]);
  });

  test("maps party summaries and forwards an optional party filter", async () => {
    reportQueries.findPartySummaryRows.mockResolvedValue([
      {
        party: "ACME",
        sales_amount: "1000",
        return_amount: "100",
        net_sales: "900",
        invoice_count: 4n,
      },
    ]);

    const result = await reportService.getPartyDetails(
      "2025-04-01",
      "2026-04-01",
      ["S"],
      ["SR"],
      ["S", "SR"],
      "ACME",
    );

    expect(result).toEqual([
      {
        party: "ACME",
        grossAmount: 1000,
        returnAmount: 100,
        netAmount: 900,
        invoiceCount: 4,
      },
    ]);
    expect(reportQueries.findPartySummaryRows).toHaveBeenCalledWith(
      "2025-04-01",
      "2026-04-01",
      ["S"],
      ["SR"],
      ["S", "SR"],
      "ACME",
    );
  });

  test("flattens party transactions returned by Prisma", async () => {
    reportQueries.findPartyTransactions.mockResolvedValue([
      {
        comp_no: 1,
        code: "S",
        bill_no: "S-1",
        bill_date: new Date("2025-04-02"),
        party: "ACME",
        agent: "SAM",
        net_amount: "500",
        bill_data: [
          {
            item_name: "COTTON",
            pcs: 5,
            meters: 20,
            weight: 4,
            per: "MTR",
            discount: 2,
            rate: 25,
            final_amount: 500,
          },
        ],
      },
    ]);

    const result = await reportService.getIndividualPartyData(
      "2025-04-01",
      "2026-04-01",
      "party",
      "ACME",
      ["S", "SR"],
    );

    expect(result).toEqual([
      expect.objectContaining({
        compNo: 1,
        code: "S",
        billNo: "S-1",
        party: "ACME",
        itemName: "COTTON",
        totalAmount: 500,
      }),
    ]);
  });

  test("calculates an individual item's bill and return summary", async () => {
    reportQueries.findItemTransactions.mockResolvedValue([
      {
        comp_no: 1,
        code: "S",
        bill_no: "S-1",
        bill_date: new Date("2025-04-02"),
        party: "ACME",
        bill_data: [
          {
            item_name: "COTTON",
            pcs: "5",
            meters: "20",
            weight: "4",
            per: "MTR",
            final_amount: "500",
          },
        ],
      },
      {
        comp_no: 1,
        code: "SR",
        bill_no: "SR-1",
        bill_date: new Date("2025-04-03"),
        party: "ACME",
        bill_data: [
          {
            item_name: "COTTON",
            pcs: "1",
            meters: "4",
            weight: "1",
            per: "MTR",
            final_amount: "100",
          },
        ],
      },
    ]);

    const result = await reportService.getIndividualItemDetails(
      "2025-04-01",
      "2026-04-01",
      "COTTON",
      ["S"],
      ["SR"],
    );

    expect(result.data).toHaveLength(2);
    expect(result.summary).toEqual([
      {
        grossAmount: 500,
        returnAmount: 100,
        netAmount: 400,
        totalPcs: 5,
        totalMeters: 20,
        totalWeight: 4,
      },
    ]);
    expect(reportQueries.findItemTransactions).toHaveBeenCalledWith(
      "2025-04-01",
      "2026-04-01",
      "COTTON",
      ["S", "SR"],
    );
  });
});
