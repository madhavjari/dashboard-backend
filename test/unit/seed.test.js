const {
  BULK_ENTRY_COUNT_PER_TYPE,
  BULK_FINANCIAL_YEARS,
  LOCAL_ACCOUNTING_COMPANIES,
  LOCAL_TENANT,
  assertSafeSeedTarget,
  createBillData,
  createBulkSeedData,
  createVoucherData,
  isLocalDatabaseUrl,
} = require("../../prisma/seed");

describe("local database seed", () => {
  test("recognizes supported local PostgreSQL hosts", () => {
    expect(
      isLocalDatabaseUrl("postgresql://postgres:password@localhost:5432/db"),
    ).toBe(true);
    expect(
      isLocalDatabaseUrl("postgresql://postgres:password@127.0.0.1:5432/db"),
    ).toBe(true);
    expect(
      isLocalDatabaseUrl("postgresql://postgres:password@[::1]:5432/db"),
    ).toBe(true);
  });

  test("refuses an accidental remote or production seed", () => {
    expect(() =>
      assertSafeSeedTarget({
        DATABASE_URL: "postgresql://user:password@example.com/database",
        NODE_ENV: "development",
      }),
    ).toThrow("Refusing to seed a non-local DATABASE_URL");

    expect(() =>
      assertSafeSeedTarget({
        DATABASE_URL: "postgresql://user:password@localhost/database",
        NODE_ENV: "production",
      }),
    ).toThrow("Refusing to seed while NODE_ENV=production");
  });

  test("allows an explicitly approved remote development seed", () => {
    expect(() =>
      assertSafeSeedTarget({
        DATABASE_URL: "postgresql://user:password@example.com/database",
        NODE_ENV: "development",
        ALLOW_REMOTE_SEED: "1",
      }),
    ).not.toThrow();
  });

  test("provides report and outstanding sample records", () => {
    const bills = createBillData(LOCAL_TENANT);
    const vouchers = createVoucherData(LOCAL_TENANT);

    expect(bills.map((bill) => bill.code)).toEqual([
      "S",
      "S",
      "SR",
      "P",
      "PR",
    ]);
    expect(vouchers.map((voucher) => voucher.voucherType)).toEqual([
      "BR",
      "BR",
      "BP",
    ]);
    expect(
      vouchers.flatMap((voucher) => voucher.allocations.create).map(
        (allocation) => allocation.code,
      ),
    ).toEqual(["BR", "BR", "BP"]);

    for (const item of bills.flatMap((bill) => bill.items.create)) {
      expect(item).not.toHaveProperty("companyId");
    }
    for (const allocation of vouchers.flatMap(
      (voucher) => voucher.allocations.create,
    )) {
      expect(allocation).not.toHaveProperty("companyId");
    }
  });

  test("creates large data across both companies and all four years", () => {
    const dataset = createBulkSeedData();
    const sales = dataset.bills.filter((bill) => bill.code === "S");
    const purchases = dataset.bills.filter((bill) => bill.code === "P");

    expect(sales).toHaveLength(BULK_ENTRY_COUNT_PER_TYPE);
    expect(purchases).toHaveLength(BULK_ENTRY_COUNT_PER_TYPE);
    expect(dataset.billItems).toHaveLength(BULK_ENTRY_COUNT_PER_TYPE * 2);
    expect(dataset.vouchers).toHaveLength(1_600);
    expect(dataset.allocations).toHaveLength(1_600);

    for (const accountingCompany of LOCAL_ACCOUNTING_COMPANIES) {
      for (const financialYear of BULK_FINANCIAL_YEARS) {
        expect(
          sales.filter(
            (bill) =>
              bill.accountingCompanyId === accountingCompany.id &&
              bill.financialYear === financialYear,
          ),
        ).toHaveLength(125);
        expect(
          purchases.filter(
            (bill) =>
              bill.accountingCompanyId === accountingCompany.id &&
              bill.financialYear === financialYear,
          ),
        ).toHaveLength(125);
      }
    }
  });

  test("creates matching allocations and meaningful outstanding balances", () => {
    const dataset = createBulkSeedData();
    const voucherByEntryId = new Map(
      dataset.vouchers.map((voucher) => [voucher.entryId, voucher]),
    );
    const billKeys = new Set(
      dataset.bills.map((bill) =>
        JSON.stringify([
          bill.accountingCompanyId,
          bill.financialYear,
          bill.billNo,
          bill.party,
        ]),
      ),
    );

    for (const allocation of dataset.allocations) {
      const voucher = voucherByEntryId.get(allocation.parentEntryId);
      expect(voucher).toBeDefined();
      expect(
        billKeys.has(
          JSON.stringify([
            voucher.accountingCompanyId,
            voucher.financialYear,
            allocation.data.billNo,
            voucher.party,
          ]),
        ),
      ).toBe(true);
    }

    const salesTotal = dataset.bills
      .filter((bill) => bill.code === "S")
      .reduce((total, bill) => total + Number(bill.netAmount), 0);
    const salesAdjusted = dataset.allocations
      .filter((allocation) => allocation.data.code === "BR")
      .reduce(
        (total, allocation) =>
          total + Number(allocation.data.adjustedAmount),
        0,
      );

    expect(salesAdjusted).toBeGreaterThan(0);
    expect(salesAdjusted).toBeLessThan(salesTotal);
  });
});
