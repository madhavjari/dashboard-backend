const express = require("express");
const request = require("supertest");

jest.mock("../middleware/verifyToken", () => (req, res, next) => next());

jest.mock("../controllers/salesReportController", () => ({
  getKPISummary: jest.fn((req, res) =>
    res.status(200).json({ handler: "sales-kpi", query: req.query }),
  ),
  getMonthlyReport: jest.fn((req, res) =>
    res.status(200).json({ handler: "sales-monthly", query: req.query }),
  ),
  getCustomerWiseSales: jest.fn((req, res) =>
    res.status(200).json({ handler: "sales-customers", query: req.query }),
  ),
  getItemWiseSales: jest.fn((req, res) =>
    res.status(200).json({ handler: "sales-items", query: req.query }),
  ),
  getCustomerDetails: jest.fn((req, res) =>
    res.status(200).json({ handler: "sales-customer", query: req.query }),
  ),
}));

jest.mock("../controllers/purchaseReportController", () => ({
  getKPISummary: jest.fn((req, res) =>
    res.status(200).json({ handler: "purchase-kpi", query: req.query }),
  ),
  getMonthlyReport: jest.fn((req, res) =>
    res.status(200).json({ handler: "purchase-monthly", query: req.query }),
  ),
  getSupplierWisePurchase: jest.fn((req, res) =>
    res.status(200).json({ handler: "purchase-suppliers", query: req.query }),
  ),
  getItemWisePurchases: jest.fn((req, res) =>
    res.status(200).json({ handler: "purchase-items", query: req.query }),
  ),
  getSupplierDetails: jest.fn((req, res) =>
    res.status(200).json({ handler: "purchase-supplier", query: req.query }),
  ),
}));

jest.mock("../controllers/itemReportController", () => ({
  getSalesItemDetails: jest.fn((req, res) =>
    res.status(200).json({ handler: "sales-item", query: req.query }),
  ),
  getPurchaseItemDetails: jest.fn((req, res) =>
    res.status(200).json({ handler: "purchase-item", query: req.query }),
  ),
}));

const salesReportController = require("../controllers/salesReportController");
const purchaseReportController = require("../controllers/purchaseReportController");
const itemReportController = require("../controllers/itemReportController");
const salesReportRouter = require("../routes/salesReportRouter");
const purchaseReportRouter = require("../routes/purchaseReportRouter");

function createApp(router) {
  const app = express();
  app.use(router);
  return app;
}

const salesApp = createApp(salesReportRouter);
const purchaseApp = createApp(purchaseReportRouter);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("sales report routes", () => {
  test.each([
    ["/api/v1/reports/sales/KPI-summary", salesReportController.getKPISummary],
    ["/api/v1/reports/sales/customers", salesReportController.getCustomerWiseSales],
    ["/api/v1/reports/sales/items", salesReportController.getItemWiseSales],
  ])("GET %s calls its controller", async (path, controller) => {
    const res = await request(salesApp).get(path);

    expect(res.status).toBe(200);
    expect(controller).toHaveBeenCalledTimes(1);
  });

  test("validates and normalizes the customer query", async () => {
    const res = await request(salesApp)
      .get("/api/v1/reports/sales/customer")
      .query({ party: "  Acme Textiles  " });

    expect(res.status).toBe(200);
    expect(res.body.query.party).toBe("ACME TEXTILES");
    expect(salesReportController.getCustomerDetails).toHaveBeenCalledTimes(1);
  });

  test("rejects a missing customer query before the controller", async () => {
    const res = await request(salesApp).get("/api/v1/reports/sales/customer");

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("party");
    expect(salesReportController.getCustomerDetails).not.toHaveBeenCalled();
  });

  test("validates and normalizes the sales item query", async () => {
    const res = await request(salesApp)
      .get("/api/v1/reports/sales/item")
      .query({ item: "  Cotton Fabric  " });

    expect(res.status).toBe(200);
    expect(res.body.query.item).toBe("COTTON FABRIC");
    expect(itemReportController.getSalesItemDetails).toHaveBeenCalledTimes(1);
  });
});

describe("purchase report routes", () => {
  test.each([
    [
      "/api/v1/reports/purchases/KPI-summary",
      purchaseReportController.getKPISummary,
    ],
    [
      "/api/v1/reports/purchases/suppliers",
      purchaseReportController.getSupplierWisePurchase,
    ],
    [
      "/api/v1/reports/purchases/items",
      purchaseReportController.getItemWisePurchases,
    ],
  ])("GET %s calls its controller", async (path, controller) => {
    const res = await request(purchaseApp).get(path);

    expect(res.status).toBe(200);
    expect(controller).toHaveBeenCalledTimes(1);
  });

  test("validates and normalizes the supplier query", async () => {
    const res = await request(purchaseApp)
      .get("/api/v1/reports/purchases/supplier")
      .query({ party: "  Acme Textiles  " });

    expect(res.status).toBe(200);
    expect(res.body.query.party).toBe("ACME TEXTILES");
    expect(purchaseReportController.getSupplierDetails).toHaveBeenCalledTimes(
      1,
    );
  });

  test("rejects a missing supplier query before the controller", async () => {
    const res = await request(purchaseApp).get(
      "/api/v1/reports/purchases/supplier",
    );

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("party");
    expect(purchaseReportController.getSupplierDetails).not.toHaveBeenCalled();
  });

  test("validates and normalizes the purchase item query", async () => {
    const res = await request(purchaseApp)
      .get("/api/v1/reports/purchases/item")
      .query({ item: "  Cotton Fabric  " });

    expect(res.status).toBe(200);
    expect(res.body.query.item).toBe("COTTON FABRIC");
    expect(itemReportController.getPurchaseItemDetails).toHaveBeenCalledTimes(
      1,
    );
  });
});
