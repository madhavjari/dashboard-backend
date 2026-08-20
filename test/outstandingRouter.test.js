const express = require("express");
const request = require("supertest");

jest.mock("../middleware/verifyToken", () => (req, res, next) => next());

jest.mock("../services/outstandingService", () => ({
  getSales: jest.fn(),
  getPurchases: jest.fn(),
}));

const outstandingService = require("../services/outstandingService");
const outstandingRouter = require("../routes/outstandingRouter");
const { DEMO_TENANT } = require("../config/demoTenant");

const app = express();
app.use(outstandingRouter);

describe("GET /api/v1/reports/outstanding/sales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns the sales collection summary from the service", async () => {
    const report = {
      summary: { totalToCollect: 400, invoiceCount: 1 },
      data: [{ billNo: "S-100", amountToCollect: 400 }],
    };
    outstandingService.getSales.mockResolvedValue(report);

    const res = await request(app)
      .get("/api/v1/reports/outstanding/sales")
      .query({ party: "ACME TEXTILES" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(report);
    expect(outstandingService.getSales).toHaveBeenCalledWith(
      { mode: "demo", companyId: DEMO_TENANT.companyId },
      { party: "ACME TEXTILES" },
    );
  });
});

describe("GET /api/v1/reports/outstanding/purchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns the purchase payment summary from the service", async () => {
    const report = {
      summary: { totalToPay: 250, invoiceCount: 1 },
      data: [{ billNo: "P-100", amountToPay: 250 }],
    };
    outstandingService.getPurchases.mockResolvedValue(report);

    const res = await request(app).get(
      "/api/v1/reports/outstanding/purchases",
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(report);
    expect(outstandingService.getPurchases).toHaveBeenCalledWith(
      { mode: "demo", companyId: DEMO_TENANT.companyId },
      {},
    );
  });
});
