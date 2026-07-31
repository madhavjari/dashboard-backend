jest.mock("../../lib/neon.js", () => ({
  neonprisma: {
    sales_entries: { findMany: jest.fn() },
    bill_payment_allocations: { findMany: jest.fn() },
  },
}));

const { neonprisma } = require("../../lib/neon.js");
const { getSales, getPurchases } = require("../../db/outstandingQueries.js");

describe("outstandingQueries.getSales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("subtracts BR allocation adjustments from each sales bill", async () => {
    neonprisma.sales_entries.findMany.mockResolvedValue([
      {
        bill_no: "S-100",
        bill_date: new Date("2026-04-05"),
        party: "ACME TEXTILES",
        net_amount: "1000.00",
      },
      {
        bill_no: "S-101",
        bill_date: new Date("2026-04-06"),
        party: "BETA TEXTILES",
        net_amount: "500.00",
      },
    ]);
    neonprisma.bill_payment_allocations.findMany.mockResolvedValue([
      {
        bill_no: "S-100",
        adjust_amt: "600.00",
        unadj_amt: "25.00",
        bal_amt: "400.00",
        payment_vouchers: {
          mode: "CHQ",
          party: "ACME TEXTILES",
          cheque_date: new Date("2026-04-07"),
          clearing_date: new Date("2026-04-10"),
          net_amount: "625.00",
        },
      },
    ]);

    const report = await getSales();

    expect(report.summary).toEqual({
      totalSalesAmount: 1500,
      totalAdjustedAmount: 600,
      totalSalesReturnAmount: 0,
      totalToCollect: 900,
      totalOverpaidAmount: 0,
      invoiceCount: 2,
      paidInvoiceCount: 0,
      outstandingInvoiceCount: 2,
    });
    expect(report.partySummary).toEqual([
      expect.objectContaining({ party: "BETA TEXTILES", amountToCollect: 500 }),
      expect.objectContaining({ party: "ACME TEXTILES", amountToCollect: 400 }),
    ]);
    expect(report.data[0]).toEqual(
      expect.objectContaining({
        billNo: "S-100",
        billAmount: 1000,
        adjustedAmount: 600,
        amountToCollect: 400,
        averagePaymentDays: 5,
        payments: [
          expect.objectContaining({
            mode: "CHQ",
            netAmount: 625,
            adjustedAmount: 600,
          }),
        ],
      }),
    );
    expect(neonprisma.bill_payment_allocations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          code: "BR",
          bill_no: { in: ["S-100", "S-101"] },
        }),
      }),
    );
  });

  test("returns an empty report without querying allocations when there are no sales bills", async () => {
    neonprisma.sales_entries.findMany.mockResolvedValue([]);

    await expect(getSales()).resolves.toEqual({
      summary: {
        totalSalesAmount: 0,
        totalAdjustedAmount: 0,
        totalSalesReturnAmount: 0,
        totalToCollect: 0,
        totalOverpaidAmount: 0,
        invoiceCount: 0,
        paidInvoiceCount: 0,
        outstandingInvoiceCount: 0,
      },
      data: [],
      partySummary: [],
    });
    expect(neonprisma.bill_payment_allocations.findMany).not.toHaveBeenCalled();
  });

  test("subtracts sales returns from the affected party's amount to collect", async () => {
    neonprisma.sales_entries.findMany.mockResolvedValue([
      {
        code: "S",
        bill_no: "S-100",
        bill_date: new Date("2026-04-05"),
        party: "ACME TEXTILES",
        net_amount: "1000.00",
      },
      {
        code: "SR",
        bill_no: null,
        bill_date: new Date("2026-04-06"),
        party: "ACME TEXTILES",
        net_amount: "250.00",
      },
    ]);
    neonprisma.bill_payment_allocations.findMany.mockResolvedValue([]);

    const report = await getSales();

    expect(report.summary.totalSalesReturnAmount).toBe(250);
    expect(report.summary.totalToCollect).toBe(750);
    expect(report.partySummary).toEqual([
      expect.objectContaining({
        party: "ACME TEXTILES",
        totalSalesReturnAmount: 250,
        amountToCollect: 750,
      }),
    ]);
  });

  test("does not apply a BR allocation when the voucher party differs", async () => {
    neonprisma.sales_entries.findMany.mockResolvedValue([
      {
        code: "S",
        bill_no: "S-100",
        bill_date: new Date("2026-04-05"),
        party: "ACME TEXTILES",
        net_amount: "1000.00",
      },
    ]);
    neonprisma.bill_payment_allocations.findMany.mockResolvedValue([
      {
        bill_no: "S-100",
        adjust_amt: "1000.00",
        unadj_amt: "0.00",
        bal_amt: "0.00",
        payment_vouchers: {
          mode: "CASH",
          party: "ANOTHER COMPANY",
          cheque_date: null,
          clearing_date: null,
          net_amount: "1000.00",
        },
      },
    ]);

    const report = await getSales();

    expect(report.data[0]).toEqual(
      expect.objectContaining({ adjustedAmount: 0, amountToCollect: 1000 }),
    );
  });
});

describe("outstandingQueries.getPurchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("subtracts BP allocation adjustments from each purchase bill", async () => {
    neonprisma.sales_entries.findMany.mockResolvedValue([
      {
        bill_no: "P-100",
        bill_date: new Date("2026-04-05"),
        party: "FABRIC SUPPLIER",
        net_amount: "1000.00",
      },
    ]);
    neonprisma.bill_payment_allocations.findMany.mockResolvedValue([
      {
        bill_no: "P-100",
        adjust_amt: "750.00",
        unadj_amt: "0.00",
        bal_amt: "250.00",
        payment_vouchers: {
          mode: "CASH",
          party: "FABRIC SUPPLIER",
          cheque_date: null,
          clearing_date: null,
          net_amount: "750.00",
        },
      },
    ]);

    const report = await getPurchases();

    expect(report.summary).toEqual({
      totalPurchaseAmount: 1000,
      totalAdjustedAmount: 750,
      totalToPay: 250,
      totalOverpaidAmount: 0,
      invoiceCount: 1,
      paidInvoiceCount: 0,
      outstandingInvoiceCount: 1,
    });
    expect(report.data[0]).toEqual(
      expect.objectContaining({
        billNo: "P-100",
        adjustedAmount: 750,
        amountToPay: 250,
      }),
    );
    expect(neonprisma.sales_entries.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ code: { in: ["P", "OP"] } }),
      }),
    );
    expect(neonprisma.bill_payment_allocations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ code: "BP" }),
      }),
    );
  });
});
