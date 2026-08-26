jest.mock("../../services/reportService.js", () => ({
  getKPI: jest.fn(),
  getMonthlySales: jest.fn(),
  getPartyDetails: jest.fn(),
  getItemWiseSummary: jest.fn(),
  getIndividualPartyData: jest.fn(),
}));

const { getPartyDetails } = require("../../services/reportService.js");
const {
  createReportController,
} = require("../../controllers/reportControllerFactory.js");

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
      outstandingSummary: { totalToCollect: 275 },
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
});
