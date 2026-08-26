const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET_KEY = "test-secret";
process.env.JWT_ISSUER = "test-issuer";
process.env.JWT_AUDIENCE = "test-audience";
process.env.DEMO_COMPANY_ID = "demo_company";

jest.mock("../db/authQueries", () => ({
  findUser: jest.fn(),
}));

jest.mock("../controllers/salesReportController", () => ({
  getKPISummary: jest.fn((req, res) => res.status(200).json({ ok: true })),
  getMonthlyReport: jest.fn((req, res) => res.status(200).json({ ok: true })),
  getCustomerWiseSales: jest.fn((req, res) =>
    res.status(200).json({ ok: true }),
  ),
  getItemWiseSales: jest.fn((req, res) =>
    res.status(200).json({ ok: true }),
  ),
  getCustomerDetails: jest.fn((req, res) =>
    res.status(200).json({ ok: true }),
  ),
}));

jest.mock("../controllers/purchaseReportController", () => ({
  getKPISummary: jest.fn((req, res) => res.status(200).json({ ok: true })),
  getMonthlyReport: jest.fn((req, res) => res.status(200).json({ ok: true })),
  getSupplierWisePurchase: jest.fn((req, res) =>
    res.status(200).json({ ok: true }),
  ),
  getItemWisePurchases: jest.fn((req, res) =>
    res.status(200).json({ ok: true }),
  ),
  getSupplierDetails: jest.fn((req, res) =>
    res.status(200).json({ ok: true }),
  ),
}));

jest.mock("../controllers/itemReportController", () => ({
  getSalesItemDetails: jest.fn((req, res) =>
    res.status(200).json({ ok: true }),
  ),
  getPurchaseItemDetails: jest.fn((req, res) =>
    res.status(200).json({ ok: true }),
  ),
}));

jest.mock("../controllers/outstandingController", () => ({
  getSales: jest.fn((req, res) => res.status(200).json({ ok: true })),
  getPurchases: jest.fn((req, res) => res.status(200).json({ ok: true })),
}));

jest.mock("../controllers/cashflowController", () => ({
  getCashflow: jest.fn((req, res) => res.status(200).json({ ok: true })),
}));

const { findUser } = require("../db/authQueries");
const salesReportController = require("../controllers/salesReportController");
const purchaseReportController = require("../controllers/purchaseReportController");
const itemReportController = require("../controllers/itemReportController");
const outstandingController = require("../controllers/outstandingController");
const cashflowController = require("../controllers/cashflowController");
const salesReportRouter = require("../routes/salesReportRouter");
const purchaseReportRouter = require("../routes/purchaseReportRouter");
const outstandingRouter = require("../routes/outstandingRouter");
const cashflowRouter = require("../routes/cashflowRouter");

const app = express();
app.use(salesReportRouter);
app.use(purchaseReportRouter);
app.use(outstandingRouter);
app.use(cashflowRouter);

const accessToken = jwt.sign(
  { sub: "user_1" },
  process.env.JWT_SECRET_KEY,
  {
    algorithm: "HS256",
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    expiresIn: "15m",
  },
);

const protectedRoutes = [
  [
    "/api/v1/reports/sales/KPI-summary",
    salesReportController.getKPISummary,
  ],
  ["/api/v1/reports/sales/monthly", salesReportController.getMonthlyReport],
  [
    "/api/v1/reports/sales/customers",
    salesReportController.getCustomerWiseSales,
  ],
  ["/api/v1/reports/sales/items", salesReportController.getItemWiseSales],
  [
    "/api/v1/reports/sales/customer?party=ACME",
    salesReportController.getCustomerDetails,
  ],
  [
    "/api/v1/reports/sales/item?item=COTTON",
    itemReportController.getSalesItemDetails,
  ],
  [
    "/api/v1/reports/purchases/KPI-summary",
    purchaseReportController.getKPISummary,
  ],
  [
    "/api/v1/reports/purchases/monthly",
    purchaseReportController.getMonthlyReport,
  ],
  [
    "/api/v1/reports/purchases/suppliers",
    purchaseReportController.getSupplierWisePurchase,
  ],
  [
    "/api/v1/reports/purchases/items",
    purchaseReportController.getItemWisePurchases,
  ],
  [
    "/api/v1/reports/purchases/supplier?party=ACME",
    purchaseReportController.getSupplierDetails,
  ],
  [
    "/api/v1/reports/purchases/item?item=COTTON",
    itemReportController.getPurchaseItemDetails,
  ],
  ["/api/v1/reports/outstanding/sales", outstandingController.getSales],
  [
    "/api/v1/reports/outstanding/purchases",
    outstandingController.getPurchases,
  ],
  ["/api/v1/reports/cashflow", cashflowController.getCashflow],
];

beforeEach(() => {
  jest.clearAllMocks();
  findUser.mockResolvedValue({
    id: "user_1",
    email: "owner@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    emailVerified: true,
    companies: [{ companyId: "company_1", role: "OWNER" }],
  });
});

describe("report route access", () => {
  test("passes a deduplicated accounting-company selection into report scope", async () => {
    const firstId = "00000000-0000-4000-8000-000000000201";
    const secondId = "00000000-0000-4000-8000-000000000202";
    const response = await request(app)
      .get("/api/v1/reports/sales/KPI-summary")
      .query({ accountingCompanyIds: `${firstId},${secondId},${firstId}` })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const controllerRequest = salesReportController.getKPISummary.mock.calls[0][0];
    expect(controllerRequest.reportContext).toEqual({
      mode: "authenticated",
      userId: "user_1",
      companyIds: ["company_1"],
      accountingCompanyIds: [firstId, secondId],
    });
  });

  test.each(protectedRoutes)(
    "GET %s uses the demo context for anonymous requests",
    async (url, controller) => {
      const response = await request(app).get(url);

      expect(response.status).toBe(200);
      expect(controller).toHaveBeenCalledTimes(1);
      const controllerRequest = controller.mock.calls[0][0];
      expect(controllerRequest.user).toBeUndefined();
      expect(controllerRequest.reportContext).toEqual({
        mode: "demo",
        companyId: "demo_company",
      });
      expect(findUser).not.toHaveBeenCalled();
    },
  );

  test.each(protectedRoutes)(
    "GET %s uses the user context for a valid access token",
    async (url, controller) => {
      const response = await request(app)
        .get(url)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(controller).toHaveBeenCalledTimes(1);
      const controllerRequest = controller.mock.calls[0][0];
      expect(controllerRequest.user.id).toBe("user_1");
      expect(controllerRequest.reportContext).toEqual({
        mode: "authenticated",
        userId: "user_1",
        companyIds: ["company_1"],
      });
    },
  );

  test.each(protectedRoutes)(
    "GET %s rejects an invalid token instead of falling back to demo",
    async (url, controller) => {
      const response = await request(app)
        .get(url)
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: "Invalid Credentials" });
      expect(controller).not.toHaveBeenCalled();
    },
  );
});
