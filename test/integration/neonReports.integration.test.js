const request = require("supertest");

const app = require("../../app");
const { prisma } = require("../../lib/prisma");

const describeNeon =
  process.env.RUN_NEON_INTEGRATION === "1" ? describe : describe.skip;

describeNeon("Neon normalized demo report integration", () => {
  jest.setTimeout(30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("serves preserved demo data from tenant-aware bill tables", async () => {
    const [kpi, monthly, customers, items] = await Promise.all([
      request(app).get("/api/v1/reports/sales/KPI-summary"),
      request(app).get("/api/v1/reports/sales/monthly"),
      request(app).get("/api/v1/reports/sales/customers"),
      request(app).get("/api/v1/reports/sales/items"),
    ]);

    for (const response of [kpi, monthly, customers, items]) {
      expect(response.status).toBe(200);
    }
    expect(kpi.body.data.invoiceCount).toBeGreaterThan(0);
    expect(monthly.body.data.length).toBeGreaterThan(0);
    expect(customers.body.data.length).toBeGreaterThan(0);
    expect(items.body.summary.totalUniqueItems).toBeGreaterThan(0);
  });

  it("serves preserved demo outstanding data from normalized vouchers", async () => {
    const [sales, purchases] = await Promise.all([
      request(app).get("/api/v1/reports/outstanding/sales"),
      request(app).get("/api/v1/reports/outstanding/purchases"),
    ]);

    expect(sales.status).toBe(200);
    expect(purchases.status).toBe(200);
    expect(sales.body.summary.invoiceCount).toBeGreaterThan(0);
    expect(purchases.body.summary.invoiceCount).toBeGreaterThan(0);
  });
});
