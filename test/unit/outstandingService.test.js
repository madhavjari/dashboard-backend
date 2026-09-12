jest.mock("../../db/outstandingQueries", () => ({
  findBillEntries: jest.fn(),
  findPaymentAllocations: jest.fn(),
}));

const outstandingQueries = require("../../db/outstandingQueries");
const { getSales, getPurchases } = require("../../services/outstandingService.js");
const { DEFAULT_FINANCIAL_YEAR } = require("../../utils/financialYear");

describe("outstandingService.getSales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("subtracts BR allocation adjustments from each sales bill", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([
      {
        bill_no: "S-100",
        bill_date: new Date("2026-04-05"),
        party: "ACME TEXTILES",
        net_amount: "1000.00",
        item_names: ["COTTON", "LINEN"],
      },
      {
        bill_no: "S-101",
        bill_date: new Date("2026-04-06"),
        party: "BETA TEXTILES",
        net_amount: "500.00",
      },
    ]);
    outstandingQueries.findPaymentAllocations.mockResolvedValue([
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
        itemNames: ["COTTON", "LINEN"],
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
    expect(outstandingQueries.findPaymentAllocations).toHaveBeenCalledWith(
      undefined,
      ["BR", "CR"],
      [],
      ["S-100", "S-101"],
      DEFAULT_FINANCIAL_YEAR,
    );
  });

  test("returns an empty report without querying allocations when there are no sales bills", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([]);

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
    expect(outstandingQueries.findPaymentAllocations).not.toHaveBeenCalled();
  });

  test("matches an allocation by bill entry source ID instead of bill number", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([
      {
        accounting_company_id: "books-1",
        bill_entry_source_id: "100",
        code: "S",
        bill_no: "S-1",
        bill_date: new Date("2026-04-05"),
        party: "ACME TEXTILES",
        net_amount: "1000.00",
      },
      {
        accounting_company_id: "books-1",
        bill_entry_source_id: "101",
        code: "S",
        bill_no: "S-2",
        bill_date: new Date("2026-04-06"),
        party: "ACME TEXTILES",
        net_amount: "500.00",
      },
    ]);
    outstandingQueries.findPaymentAllocations.mockResolvedValue([
      {
        accounting_company_id: "books-1",
        bill_entry_source_id: "101",
        bill_no: "S-2",
        adjust_amt: "500.00",
        unadj_amt: "0.00",
        bal_amt: "0.00",
        payment_vouchers: {
          mode: "CASH",
          party: "ACME TEXTILES",
          cheque_date: null,
          clearing_date: null,
          net_amount: "500.00",
        },
      },
    ]);

    const report = await getSales();

    expect(report.data).toEqual([
      expect.objectContaining({
        billEntrySourceId: "100",
        amountToCollect: 1000,
        adjustedAmount: 0,
      }),
      expect.objectContaining({
        billEntrySourceId: "101",
        amountToCollect: 0,
        adjustedAmount: 500,
      }),
    ]);
  });

  test("matches split allocations when the company CompNo changes between years", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([
      {
        accounting_company_id: "books-2025",
        accounting_company_key: '["company-1","MADHAV ENTERPRISE"]',
        bill_entry_source_id: "2960",
        code: "S",
        bill_no: "S-4",
        bill_date: new Date("2025-04-05"),
        party: "ACME TEXTILES",
        net_amount: "1000.00",
      },
    ]);
    outstandingQueries.findPaymentAllocations.mockResolvedValue([
      {
        accounting_company_id: "books-2026",
        accounting_company_key: '["company-1","MADHAV ENTERPRISE"]',
        bill_entry_source_id: "2960",
        bill_no: "S-4",
        adjust_amt: "400.00",
        unadj_amt: "0.00",
        bal_amt: "600.00",
        payment_vouchers: {
          mode: "BANK",
          party: "ACME TEXTILES",
          cheque_date: null,
          clearing_date: null,
          net_amount: "400.00",
        },
      },
      {
        accounting_company_id: "books-2026",
        accounting_company_key: '["company-1","MADHAV ENTERPRISE"]',
        bill_entry_source_id: "2960",
        bill_no: "S-4",
        adjust_amt: "600.00",
        unadj_amt: "0.00",
        bal_amt: "0.00",
        payment_vouchers: {
          mode: "BANK",
          party: "ACME TEXTILES",
          cheque_date: null,
          clearing_date: null,
          net_amount: "600.00",
        },
      },
    ]);

    const report = await getSales({
      mode: "authenticated",
      companyIds: ["company-1"],
    });

    expect(report.data[0]).toEqual(
      expect.objectContaining({
        billEntrySourceId: "2960",
        adjustedAmount: 1000,
        amountToCollect: 0,
        payments: [
          expect.objectContaining({ adjustedAmount: 400 }),
          expect.objectContaining({ adjustedAmount: 600 }),
        ],
      }),
    );
  });

  test("applies a linked bill return adjustment once to the target bill", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([
      {
        accounting_company_id: "books-1",
        bill_entry_source_id: "100",
        code: "S",
        bill_no: "S-1",
        bill_date: new Date("2026-04-05"),
        party: "ACME TEXTILES",
        net_amount: "1000.00",
        return_adjustments: [
          {
            return_bill_entry_source_id: "900",
            adjusted_amount: "250.00",
          },
        ],
      },
      {
        accounting_company_id: "books-1",
        bill_entry_source_id: "900",
        code: "SR",
        bill_no: "SR-1",
        bill_date: new Date("2026-04-06"),
        party: "ACME TEXTILES",
        net_amount: "250.00",
      },
    ]);
    outstandingQueries.findPaymentAllocations.mockResolvedValue([]);

    const report = await getSales();

    expect(report.data[0]).toEqual(
      expect.objectContaining({
        billEntrySourceId: "100",
        billAdjustmentAmount: 250,
        adjustedAmount: 250,
        amountToCollect: 750,
      }),
    );
    expect(report.summary).toEqual(
      expect.objectContaining({
        totalSalesReturnAmount: 250,
        totalToCollect: 750,
        totalAdjustedAmount: 250,
      }),
    );
    expect(report.partySummary).toEqual([
      expect.objectContaining({
        party: "ACME TEXTILES",
        totalSalesReturnAmount: 250,
        amountToCollect: 750,
      }),
    ]);
  });

  test("subtracts sales returns from the affected party's amount to collect", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([
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
    outstandingQueries.findPaymentAllocations.mockResolvedValue([]);

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
    outstandingQueries.findBillEntries.mockResolvedValue([
      {
        code: "S",
        bill_no: "S-100",
        bill_date: new Date("2026-04-05"),
        party: "ACME TEXTILES",
        net_amount: "1000.00",
      },
    ]);
    outstandingQueries.findPaymentAllocations.mockResolvedValue([
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

describe("outstandingService.getPurchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("subtracts BP allocation adjustments from each purchase bill", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([
      {
        bill_no: "P-100",
        bill_date: new Date("2026-04-05"),
        party: "FABRIC SUPPLIER",
        net_amount: "1000.00",
      },
    ]);
    outstandingQueries.findPaymentAllocations.mockResolvedValue([
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
      totalPurchaseReturnAmount: 0,
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
    expect(outstandingQueries.findBillEntries).toHaveBeenCalledWith(
      undefined,
      ["P", "OP", "FJ", "PR", "FJR"],
      DEFAULT_FINANCIAL_YEAR,
    );
    expect(outstandingQueries.findPaymentAllocations).toHaveBeenCalledWith(
      undefined,
      ["BP", "CP"],
      [],
      ["P-100"],
      DEFAULT_FINANCIAL_YEAR,
    );
  });

  test("subtracts FJR returns from the affected supplier's amount to pay", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([
      {
        code: "FJ",
        bill_no: "FJ-100",
        bill_date: new Date("2026-04-05"),
        party: "JOB WORK SUPPLIER",
        net_amount: "10000.00",
      },
      {
        code: "FJR",
        bill_no: "FJR-1",
        bill_date: new Date("2026-04-06"),
        party: "JOB WORK SUPPLIER",
        net_amount: "7004.00",
      },
    ]);
    outstandingQueries.findPaymentAllocations.mockResolvedValue([]);

    const report = await getPurchases();

    expect(report.summary.totalPurchaseReturnAmount).toBe(7004);
    expect(report.summary.totalToPay).toBe(2996);
    expect(report.partySummary).toEqual([
      expect.objectContaining({
        party: "JOB WORK SUPPLIER",
        totalPurchaseReturnAmount: 7004,
        amountToPay: 2996,
      }),
    ]);
  });
});

describe("outstanding accounting-company isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not apply an allocation from another accounting company", async () => {
    outstandingQueries.findBillEntries.mockResolvedValue([
      {
        accounting_company_id: "books_1",
        code: "S",
        bill_no: "S-100",
        bill_date: new Date("2026-04-05"),
        party: "SAME PARTY",
        net_amount: "1000.00",
      },
    ]);
    outstandingQueries.findPaymentAllocations.mockResolvedValue([
      {
        accounting_company_id: "books_2",
        bill_no: "S-100",
        adjust_amt: "1000.00",
        unadj_amt: "0.00",
        bal_amt: "0.00",
        payment_vouchers: {
          mode: "CASH",
          party: "SAME PARTY",
          cheque_date: null,
          clearing_date: null,
          net_amount: "1000.00",
        },
      },
    ]);

    const report = await getSales();

    expect(report.data[0]).toEqual(
      expect.objectContaining({
        adjustedAmount: 0,
        amountToCollect: 1000,
      }),
    );
  });
});
