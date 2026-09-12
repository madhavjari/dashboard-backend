jest.mock("../../services/reportService.js", () => ({
  getKPI: jest.fn(),
  getMonthlySales: jest.fn(),
  getPartyDetails: jest.fn(),
  getItemWiseSummary: jest.fn(),
  getIndividualPartyData: jest.fn(),
}));

const { getKPI, getPartyDetails } = require("../../services/reportService.js");
const {
  createReportController,
} = require("../../controllers/reportControllerFactory.js");

describe("reportControllerFactory.getKPISummary", () => {
  test("uses an inclusive custom range within the selected financial year", async () => {
    getKPI.mockResolvedValue({ netAmount: 900 });
    const controller = createReportController(["S"], ["SR"], {
      getOutstandingReport: jest.fn(),
      outstandingField: "amountToCollect",
    });
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.getKPISummary(
      {
        reportContext: { companyIds: ["company_1"] },
        query: {
          financialYear: "2025-2026",
          fromDate: "2025-08-01",
          toDate: "2025-08-31",
        },
      },
      res,
    );

    expect(getKPI).toHaveBeenCalledWith(
      { companyIds: ["company_1"] },
      "2025-08-01",
      "2025-09-01",
      ["S"],
      ["SR"],
      "2025-2026",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { netAmount: 900 } });
  });
});

describe("reportControllerFactory.getPartyWiseReport", () => {
  test("adds the matching outstanding amount and overall summary", async () => {
    getPartyDetails.mockResolvedValue([
      { party: "ACME TEXTILES", netAmount: 1000 },
      { party: "NO BALANCE", netAmount: 500 },
    ]);
    const getOutstandingReport = jest.fn().mockResolvedValue({
      partySummary: [
        { party: "  acme textiles ", amountToCollect: 275 },
      ],
      summary: { totalToCollect: 275 },
      data: [],
    });
    const controller = createReportController(["S"], ["SR"], {
      getOutstandingReport,
      outstandingField: "amountToCollect",
    });
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.getPartyWiseReport(
      { query: { financialYear: "2026-2027" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [
        { party: "ACME TEXTILES", netAmount: 1000, outstandingAmount: 275 },
        { party: "NO BALANCE", netAmount: 500, outstandingAmount: 0 },
      ],
      outstandingSummary: {
        totalToCollect: 275,
        averagePaymentDays: null,
        partyPaymentCount: 0,
      },
    });
    expect(getPartyDetails).toHaveBeenCalledWith(
      undefined,
      "2026-04-01",
      "2027-04-01",
      ["S"],
      ["SR"],
      ["S", "SR"],
    );
    expect(getOutstandingReport).toHaveBeenCalledWith(undefined, {
      financialYear: "2026-2027",
    });
  });

  test("adds average payment days grouped by party", async () => {
    getPartyDetails.mockResolvedValue([]);
    const getOutstandingReport = jest.fn().mockResolvedValue({
      partySummary: [],
      summary: { totalToCollect: 0 },
      data: [
        {
          party: "ACME TEXTILES",
          billDate: "2026-04-01",
          amountToCollect: 0,
          payments: [{ clearingDate: "2026-04-06" }],
        },
        {
          party: " acme textiles ",
          billDate: "2026-04-11",
          amountToCollect: 0,
          payments: [{ chequeDate: "2026-04-21" }],
        },
        {
          party: "BETA TEXTILES",
          billDate: "2026-04-01",
          amountToCollect: 0,
          payments: [{ clearingDate: "2026-04-11" }],
        },
      ],
    });
    const controller = createReportController(["S"], ["SR"], {
      getOutstandingReport,
      outstandingField: "amountToCollect",
    });
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.getPartyWiseReport({ query: {} }, res);

    expect(res.json).toHaveBeenCalledWith({
      data: [],
      outstandingSummary: {
        totalToCollect: 0,
        averagePaymentDays: 8.75,
        partyPaymentCount: 2,
      },
    });
  });
});
