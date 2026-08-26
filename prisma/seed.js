const { DEMO_TENANT } = require("../config/demoTenant");

const LOCAL_TENANT = Object.freeze({
  companyId: "00000000-0000-4000-8000-000000000101",
  syncSourceId: "00000000-0000-4000-8000-000000000102",
  accountingCompanyId: "00000000-0000-4000-8000-000000000103",
  userId: "00000000-0000-4000-8000-000000000104",
  companyName: "Local Dashboard Account",
  syncSourceName: "Local accounting source",
  accountingCompanyName: "Sunrise Textiles Private Limited",
  externalCompanyId: "1",
});

const LOCAL_ACCOUNTING_COMPANIES = Object.freeze([
  Object.freeze({
    id: LOCAL_TENANT.accountingCompanyId,
    externalId: LOCAL_TENANT.externalCompanyId,
    name: LOCAL_TENANT.accountingCompanyName,
    label: "SUNRISE",
  }),
  Object.freeze({
    id: "00000000-0000-4000-8000-000000000105",
    externalId: "2",
    name: "Moonlight Fabrics LLP",
    label: "MOONLIGHT",
  }),
]);

const LOCAL_LOGIN = Object.freeze({
  email: "owner@example.com",
  password: "LocalDev123!",
});

const LOCAL_SYNC_API_KEY = "sync_local_seed.local-development-only";
const LOCAL_SYNC_KEY_PREFIX = "sync_local_seed";
const FINANCIAL_YEAR = "2025-2026";
const BULK_FINANCIAL_YEARS = Object.freeze([
  "2022-2023",
  "2023-2024",
  "2024-2025",
  "2025-2026",
]);
const BULK_ENTRY_COUNT_PER_TYPE = 1_000;
const BULK_BILL_PREFIX = "bulk-";
const BULK_VOUCHER_PREFIX = "bulk-voucher-";
const INSERT_BATCH_SIZE = 250;
const SEEDED_ENTRY_IDS = Object.freeze([
  "seed-sale-001",
  "seed-sale-002",
  "seed-sales-return-001",
  "seed-purchase-001",
  "seed-purchase-return-001",
]);
const SEEDED_VOUCHER_IDS = Object.freeze([
  "seed-receipt-001",
  "seed-receipt-002",
  "seed-payment-001",
]);

function getConnectionString(environment = process.env) {
  return environment.DATABASE_URL;
}

function isLocalDatabaseUrl(connectionString) {
  let databaseUrl;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    return false;
  }

  const hostname = databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return new Set(["localhost", "127.0.0.1", "::1"]).has(hostname);
}

function assertSafeSeedTarget(environment = process.env) {
  const connectionString = getConnectionString(environment);
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const remoteSeedAllowed = environment.ALLOW_REMOTE_SEED === "1";
  if (environment.NODE_ENV === "production" && !remoteSeedAllowed) {
    throw new Error(
      "Refusing to seed while NODE_ENV=production. Set ALLOW_REMOTE_SEED=1 only if this is intentional.",
    );
  }

  if (!isLocalDatabaseUrl(connectionString) && !remoteSeedAllowed) {
    throw new Error(
      "Refusing to seed a non-local DATABASE_URL. Point DATABASE_URL at localhost. Set ALLOW_REMOTE_SEED=1 only if this is intentional.",
    );
  }
}

function createBillData(tenant) {
  const shared = {
    companyId: tenant.companyId,
    syncSourceId: tenant.syncSourceId,
    accountingCompanyId: tenant.accountingCompanyId,
    compNo: tenant.externalCompanyId,
    financialYear: FINANCIAL_YEAR,
    isOpening: false,
  };

  return [
    {
      ...shared,
      entryId: "seed-sale-001",
      code: "S",
      book: "SALES",
      billNo: "SALE-001",
      billDate: new Date("2025-04-15T00:00:00.000Z"),
      party: "ACME RETAIL",
      partyCode: "CUST-001",
      grossAmount: "11800.00",
      netAmount: "11800.00",
      cgst: "900.00",
      sgst: "900.00",
      igst: "0.00",
      items: {
        create: [
          {
            entryId: "1",
            serial: "1",
            itemCode: "COTTON-001",
            itemName: "COTTON FABRIC",
            category: "FABRIC",
            itemGroup: "COTTON",
            colour: "BLUE",
            quantity: "100.000",
            meters: "100.000",
            per: "MTR",
            rate: "100.00",
            amount: "10000.00",
            taxableAmount: "10000.00",
            finalAmount: "11800.00",
            cgstRate: "9.0000",
            cgstAmount: "900.00",
            sgstRate: "9.0000",
            sgstAmount: "900.00",
          },
        ],
      },
    },
    {
      ...shared,
      entryId: "seed-sale-002",
      code: "S",
      book: "SALES",
      billNo: "SALE-002",
      billDate: new Date("2025-06-20T00:00:00.000Z"),
      party: "BETA STORES",
      partyCode: "CUST-002",
      grossAmount: "5900.00",
      netAmount: "5900.00",
      cgst: "450.00",
      sgst: "450.00",
      igst: "0.00",
      items: {
        create: [
          {
            entryId: "1",
            serial: "1",
            itemCode: "SILK-001",
            itemName: "SILK FABRIC",
            category: "FABRIC",
            itemGroup: "SILK",
            colour: "RED",
            quantity: "25.000",
            meters: "25.000",
            per: "MTR",
            rate: "200.00",
            amount: "5000.00",
            taxableAmount: "5000.00",
            finalAmount: "5900.00",
            cgstRate: "9.0000",
            cgstAmount: "450.00",
            sgstRate: "9.0000",
            sgstAmount: "450.00",
          },
        ],
      },
    },
    {
      ...shared,
      entryId: "seed-sales-return-001",
      code: "SR",
      book: "SALES RETURN",
      billNo: "SR-001",
      billDate: new Date("2025-07-05T00:00:00.000Z"),
      party: "ACME RETAIL",
      partyCode: "CUST-001",
      grossAmount: "1180.00",
      netAmount: "1180.00",
      cgst: "90.00",
      sgst: "90.00",
      igst: "0.00",
      items: {
        create: [
          {
            entryId: "1",
            serial: "1",
            itemCode: "COTTON-001",
            itemName: "COTTON FABRIC",
            category: "FABRIC",
            itemGroup: "COTTON",
            colour: "BLUE",
            quantity: "10.000",
            meters: "10.000",
            per: "MTR",
            rate: "100.00",
            amount: "1000.00",
            taxableAmount: "1000.00",
            finalAmount: "1180.00",
            cgstRate: "9.0000",
            cgstAmount: "90.00",
            sgstRate: "9.0000",
            sgstAmount: "90.00",
          },
        ],
      },
    },
    {
      ...shared,
      entryId: "seed-purchase-001",
      code: "P",
      book: "PURCHASE",
      billNo: "PUR-001",
      billDate: new Date("2025-05-10T00:00:00.000Z"),
      party: "SUPREME TEXTILES",
      partyCode: "SUP-001",
      grossAmount: "7080.00",
      netAmount: "7080.00",
      cgst: "540.00",
      sgst: "540.00",
      igst: "0.00",
      items: {
        create: [
          {
            entryId: "1",
            serial: "1",
            itemCode: "YARN-001",
            itemName: "COTTON YARN",
            category: "RAW MATERIAL",
            itemGroup: "YARN",
            quantity: "60.000",
            weight: "60.000",
            per: "KG",
            rate: "100.00",
            amount: "6000.00",
            taxableAmount: "6000.00",
            finalAmount: "7080.00",
            cgstRate: "9.0000",
            cgstAmount: "540.00",
            sgstRate: "9.0000",
            sgstAmount: "540.00",
          },
        ],
      },
    },
    {
      ...shared,
      entryId: "seed-purchase-return-001",
      code: "PR",
      book: "PURCHASE RETURN",
      billNo: "PR-001",
      billDate: new Date("2025-08-12T00:00:00.000Z"),
      party: "SUPREME TEXTILES",
      partyCode: "SUP-001",
      grossAmount: "590.00",
      netAmount: "590.00",
      cgst: "45.00",
      sgst: "45.00",
      igst: "0.00",
      items: {
        create: [
          {
            entryId: "1",
            serial: "1",
            itemCode: "YARN-001",
            itemName: "COTTON YARN",
            category: "RAW MATERIAL",
            itemGroup: "YARN",
            quantity: "5.000",
            weight: "5.000",
            per: "KG",
            rate: "100.00",
            amount: "500.00",
            taxableAmount: "500.00",
            finalAmount: "590.00",
            cgstRate: "9.0000",
            cgstAmount: "45.00",
            sgstRate: "9.0000",
            sgstAmount: "45.00",
          },
        ],
      },
    },
  ];
}

function createVoucherData(tenant) {
  const shared = {
    companyId: tenant.companyId,
    syncSourceId: tenant.syncSourceId,
    accountingCompanyId: tenant.accountingCompanyId,
    compNo: tenant.externalCompanyId,
    financialYear: FINANCIAL_YEAR,
    isOpening: false,
  };

  return [
    {
      ...shared,
      entryId: "seed-receipt-001",
      voucherDate: new Date("2025-05-15T00:00:00.000Z"),
      mode: "BANK",
      voucherType: "BR",
      referenceNo: "BR-001",
      party: "ACME RETAIL",
      chequeDate: new Date("2025-05-14T00:00:00.000Z"),
      clearingDate: new Date("2025-05-15T00:00:00.000Z"),
      chequeBank: "LOCAL BANK",
      netAmount: "5000.00",
      allocations: {
        create: [
          {
            entryId: "1",
            code: "BR",
            billNo: "SALE-001",
            allocationDate: new Date("2025-05-15T00:00:00.000Z"),
            mode: "BANK",
            billAmount: "11800.00",
            adjustedAmount: "5000.00",
            unadjustedAmount: "0.00",
            balanceAmount: "6800.00",
            status: "PARTIAL",
          },
        ],
      },
    },
    {
      ...shared,
      entryId: "seed-receipt-002",
      voucherDate: new Date("2025-07-01T00:00:00.000Z"),
      mode: "BANK",
      voucherType: "BR",
      referenceNo: "BR-002",
      party: "BETA STORES",
      chequeDate: new Date("2025-06-30T00:00:00.000Z"),
      clearingDate: new Date("2025-07-01T00:00:00.000Z"),
      chequeBank: "LOCAL BANK",
      netAmount: "5900.00",
      allocations: {
        create: [
          {
            entryId: "1",
            code: "BR",
            billNo: "SALE-002",
            allocationDate: new Date("2025-07-01T00:00:00.000Z"),
            mode: "BANK",
            billAmount: "5900.00",
            adjustedAmount: "5900.00",
            unadjustedAmount: "0.00",
            balanceAmount: "0.00",
            status: "PAID",
          },
        ],
      },
    },
    {
      ...shared,
      entryId: "seed-payment-001",
      voucherDate: new Date("2025-06-10T00:00:00.000Z"),
      mode: "BANK",
      voucherType: "BP",
      referenceNo: "BP-001",
      party: "SUPREME TEXTILES",
      chequeDate: new Date("2025-06-09T00:00:00.000Z"),
      clearingDate: new Date("2025-06-10T00:00:00.000Z"),
      chequeBank: "LOCAL BANK",
      netAmount: "3000.00",
      allocations: {
        create: [
          {
            entryId: "1",
            code: "BP",
            billNo: "PUR-001",
            allocationDate: new Date("2025-06-10T00:00:00.000Z"),
            mode: "BANK",
            billAmount: "7080.00",
            adjustedAmount: "3000.00",
            unadjustedAmount: "0.00",
            balanceAmount: "4080.00",
            status: "PARTIAL",
          },
        ],
      },
    },
  ];
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function formatMoney(value) {
  return Number(value).toFixed(2);
}

function getFinancialYearStart(financialYear) {
  const startYear = Number(financialYear.split("-")[0]);
  return new Date(Date.UTC(startYear, 3, 1));
}

function getPaymentFraction(index) {
  const paymentGroup = index % 10;
  if (paymentGroup < 6) return 1;
  if (paymentGroup < 8) return 0.5;
  return 0;
}

function createBulkSeedData(
  accountingCompanies = LOCAL_ACCOUNTING_COMPANIES,
  entryCountPerType = BULK_ENTRY_COUNT_PER_TYPE,
  financialYears = BULK_FINANCIAL_YEARS,
) {
  const bills = [];
  const billItems = [];
  const vouchers = [];
  const allocations = [];
  const transactionTypes = [
    {
      name: "sale",
      code: "S",
      book: "SALES",
      paymentCode: "BR",
      partyType: "CUSTOMER",
      partyCount: 50,
      billPrefix: "SALE",
      itemPrefix: "FABRIC",
      itemName: "FINISHED FABRIC",
      itemGroup: "FABRIC",
      category: "FINISHED GOODS",
      unit: "MTR",
    },
    {
      name: "purchase",
      code: "P",
      book: "PURCHASE",
      paymentCode: "BP",
      partyType: "SUPPLIER",
      partyCount: 40,
      billPrefix: "PUR",
      itemPrefix: "YARN",
      itemName: "COTTON YARN",
      itemGroup: "YARN",
      category: "RAW MATERIAL",
      unit: "KG",
    },
  ];
  const companyYearCombinationCount =
    accountingCompanies.length * financialYears.length;

  for (const transactionType of transactionTypes) {
    for (let index = 0; index < entryCountPerType; index += 1) {
      const accountingCompany =
        accountingCompanies[index % accountingCompanies.length];
      const financialYear =
        financialYears[
          Math.floor(index / accountingCompanies.length) %
            financialYears.length
        ];
      const companySequence =
        Math.floor(index / companyYearCombinationCount) + 1;
      const paddedSequence = String(companySequence).padStart(4, "0");
      const yearPrefix = financialYear.split("-")[0];
      const itemSequence = String((index % 25) + 1).padStart(2, "0");
      const partySequence = String(
        (index % transactionType.partyCount) + 1,
      ).padStart(2, "0");
      const quantity = 5 + (index % 96);
      const rate = 100 + ((index * 17) % 901);
      const taxableAmount = quantity * rate;
      const cgst = taxableAmount * 0.09;
      const sgst = taxableAmount * 0.09;
      const netAmount = taxableAmount + cgst + sgst;
      const billDate = addDays(
        getFinancialYearStart(financialYear),
        (companySequence * 17 + (transactionType.code === "P" ? 9 : 0)) %
          300,
      );
      const entryId = `${BULK_BILL_PREFIX}${transactionType.name}-${accountingCompany.externalId}-${yearPrefix}-${paddedSequence}`;
      const billNo = `${transactionType.billPrefix}-${accountingCompany.externalId}-${yearPrefix}-${paddedSequence}`;
      const party = `${accountingCompany.label} ${transactionType.partyType} ${partySequence}`;
      const partyCode = `${transactionType.partyType.slice(0, 4)}-${accountingCompany.externalId}-${partySequence}`;

      bills.push({
        companyId: LOCAL_TENANT.companyId,
        syncSourceId: LOCAL_TENANT.syncSourceId,
        accountingCompanyId: accountingCompany.id,
        financialYear,
        isOpening: false,
        entryId,
        compNo: accountingCompany.externalId,
        code: transactionType.code,
        book: transactionType.book,
        billNo,
        billDate,
        party,
        partyCode,
        grossAmount: formatMoney(netAmount),
        netAmount: formatMoney(netAmount),
        cgst: formatMoney(cgst),
        sgst: formatMoney(sgst),
        igst: "0.00",
      });

      billItems.push({
        parentEntryId: entryId,
        data: {
          companyId: LOCAL_TENANT.companyId,
          entryId: "1",
          serial: "1",
          itemCode: `${transactionType.itemPrefix}-${itemSequence}`,
          itemName: `${transactionType.itemName} ${itemSequence}`,
          category: transactionType.category,
          itemGroup: transactionType.itemGroup,
          brand: accountingCompany.label,
          colour: transactionType.code === "S" ? `COLOUR ${itemSequence}` : null,
          quantity: formatMoney(quantity),
          meters:
            transactionType.unit === "MTR" ? formatMoney(quantity) : "0.00",
          weight:
            transactionType.unit === "KG" ? formatMoney(quantity) : "0.00",
          per: transactionType.unit,
          rate: formatMoney(rate),
          amount: formatMoney(taxableAmount),
          taxableAmount: formatMoney(taxableAmount),
          finalAmount: formatMoney(netAmount),
          cgstRate: "9.0000",
          cgstAmount: formatMoney(cgst),
          sgstRate: "9.0000",
          sgstAmount: formatMoney(sgst),
        },
      });

      const paymentFraction = getPaymentFraction(index);
      if (paymentFraction === 0) continue;

      const adjustedAmount = netAmount * paymentFraction;
      const balanceAmount = netAmount - adjustedAmount;
      const voucherEntryId = `${BULK_VOUCHER_PREFIX}${transactionType.paymentCode.toLowerCase()}-${accountingCompany.externalId}-${yearPrefix}-${paddedSequence}`;
      const paymentDate = addDays(billDate, 15 + (index % 45));

      vouchers.push({
        companyId: LOCAL_TENANT.companyId,
        syncSourceId: LOCAL_TENANT.syncSourceId,
        accountingCompanyId: accountingCompany.id,
        financialYear,
        isOpening: false,
        entryId: voucherEntryId,
        compNo: accountingCompany.externalId,
        voucherDate: paymentDate,
        mode: index % 3 === 0 ? "UPI" : "BANK",
        voucherType: transactionType.paymentCode,
        referenceNo: `REF-${transactionType.paymentCode}-${accountingCompany.externalId}-${paddedSequence}`,
        party,
        chequeDate: paymentDate,
        clearingDate: paymentDate,
        chequeBank: "LOCAL DEVELOPMENT BANK",
        netAmount: formatMoney(adjustedAmount),
        remarks:
          paymentFraction === 1
            ? "Fully paid seed invoice"
            : "Partially paid seed invoice",
      });

      allocations.push({
        parentEntryId: voucherEntryId,
        data: {
          companyId: LOCAL_TENANT.companyId,
          entryId: "1",
          code: transactionType.paymentCode,
          billNo,
          allocationDate: paymentDate,
          mode: index % 3 === 0 ? "UPI" : "BANK",
          billAmount: formatMoney(netAmount),
          adjustedAmount: formatMoney(adjustedAmount),
          unadjustedAmount: "0.00",
          balanceAmount: formatMoney(balanceAmount),
          status: paymentFraction === 1 ? "PAID" : "PARTIAL",
        },
      });
    }
  }

  return { bills, billItems, vouchers, allocations };
}

async function createManyInBatches(model, records) {
  for (let index = 0; index < records.length; index += INSERT_BATCH_SIZE) {
    await model.createMany({
      data: records.slice(index, index + INSERT_BATCH_SIZE),
    });
  }
}

async function seedBulkLocalData(prisma) {
  const secondAccountingCompany = LOCAL_ACCOUNTING_COMPANIES[1];
  await prisma.accountingCompany.upsert({
    where: { id: secondAccountingCompany.id },
    update: {
      externalId: secondAccountingCompany.externalId,
      name: secondAccountingCompany.name,
    },
    create: {
      id: secondAccountingCompany.id,
      companyId: LOCAL_TENANT.companyId,
      syncSourceId: LOCAL_TENANT.syncSourceId,
      externalId: secondAccountingCompany.externalId,
      name: secondAccountingCompany.name,
    },
  });

  await prisma.paymentVoucher.deleteMany({
    where: {
      companyId: LOCAL_TENANT.companyId,
      entryId: { startsWith: BULK_VOUCHER_PREFIX },
    },
  });
  await prisma.billEntry.deleteMany({
    where: {
      companyId: LOCAL_TENANT.companyId,
      entryId: { startsWith: BULK_BILL_PREFIX },
    },
  });

  const dataset = createBulkSeedData();
  await createManyInBatches(prisma.billEntry, dataset.bills);

  const storedBills = await prisma.billEntry.findMany({
    where: {
      companyId: LOCAL_TENANT.companyId,
      entryId: { startsWith: BULK_BILL_PREFIX },
    },
    select: { id: true, entryId: true },
  });
  const billIdByEntryId = new Map(
    storedBills.map((bill) => [bill.entryId, bill.id]),
  );
  const billItems = dataset.billItems.map(({ parentEntryId, data }) => ({
    ...data,
    billEntryId: billIdByEntryId.get(parentEntryId),
  }));
  await createManyInBatches(prisma.billItem, billItems);

  await createManyInBatches(prisma.paymentVoucher, dataset.vouchers);
  const storedVouchers = await prisma.paymentVoucher.findMany({
    where: {
      companyId: LOCAL_TENANT.companyId,
      entryId: { startsWith: BULK_VOUCHER_PREFIX },
    },
    select: { id: true, entryId: true },
  });
  const voucherIdByEntryId = new Map(
    storedVouchers.map((voucher) => [voucher.entryId, voucher.id]),
  );
  const paymentAllocations = dataset.allocations.map(
    ({ parentEntryId, data }) => ({
      ...data,
      paymentVoucherId: voucherIdByEntryId.get(parentEntryId),
    }),
  );
  await createManyInBatches(
    prisma.paymentAllocation,
    paymentAllocations,
  );

  return {
    sales: dataset.bills.filter((bill) => bill.code === "S").length,
    purchases: dataset.bills.filter((bill) => bill.code === "P").length,
    vouchers: dataset.vouchers.length,
    allocations: dataset.allocations.length,
  };
}

async function upsertTenant(
  prisma,
  tenant,
  { includeSampleData = true } = {},
) {
  await prisma.company.upsert({
    where: { id: tenant.companyId },
    update: {
      name: tenant.companyName,
      subscriptionStatus: "ACTIVE",
      subscriptionStartedAt: new Date("2025-04-01T00:00:00.000Z"),
      subscriptionEndsAt: null,
    },
    create: {
      id: tenant.companyId,
      name: tenant.companyName,
      subscriptionStatus: "ACTIVE",
      subscriptionStartedAt: new Date("2025-04-01T00:00:00.000Z"),
    },
  });

  await prisma.syncSource.upsert({
    where: { id: tenant.syncSourceId },
    update: {
      name: tenant.syncSourceName,
      lastSyncedAt: new Date("2025-08-12T12:00:00.000Z"),
    },
    create: {
      id: tenant.syncSourceId,
      companyId: tenant.companyId,
      name: tenant.syncSourceName,
      lastSyncedAt: new Date("2025-08-12T12:00:00.000Z"),
    },
  });

  await prisma.accountingCompany.upsert({
    where: { id: tenant.accountingCompanyId },
    update: {
      externalId: tenant.externalCompanyId,
      name: tenant.accountingCompanyName,
    },
    create: {
      id: tenant.accountingCompanyId,
      companyId: tenant.companyId,
      syncSourceId: tenant.syncSourceId,
      externalId: tenant.externalCompanyId,
      name: tenant.accountingCompanyName,
    },
  });

  await prisma.billEntry.deleteMany({
    where: {
      companyId: tenant.companyId,
      entryId: { in: SEEDED_ENTRY_IDS },
    },
  });
  await prisma.paymentVoucher.deleteMany({
    where: {
      companyId: tenant.companyId,
      entryId: { in: SEEDED_VOUCHER_IDS },
    },
  });

  if (includeSampleData) {
    for (const bill of createBillData(tenant)) {
      await prisma.billEntry.create({ data: bill });
    }
    for (const voucher of createVoucherData(tenant)) {
      await prisma.paymentVoucher.create({ data: voucher });
    }
  }
}

async function main() {
  assertSafeSeedTarget();

  const argon2 = require("argon2");
  const { prisma } = require("../lib/prisma");
  const { hashString } = require("../utils/token");

  try {
    const passwordHash = await argon2.hash(LOCAL_LOGIN.password);

    await upsertTenant(prisma, DEMO_TENANT);
    await upsertTenant(prisma, LOCAL_TENANT, {
      includeSampleData: false,
    });
    const bulkCounts = await seedBulkLocalData(prisma);

    const user = await prisma.user.upsert({
      where: { email: LOCAL_LOGIN.email },
      update: {
        firstName: "Local",
        lastName: "Owner",
        phoneNumber: "+919999999999",
        password: passwordHash,
        emailVerified: true,
      },
      create: {
        id: LOCAL_TENANT.userId,
        firstName: "Local",
        lastName: "Owner",
        email: LOCAL_LOGIN.email,
        phoneNumber: "+919999999999",
        password: passwordHash,
        emailVerified: true,
      },
    });

    await prisma.companyUser.upsert({
      where: {
        companyId_userId: {
          companyId: LOCAL_TENANT.companyId,
          userId: user.id,
        },
      },
      update: { role: "OWNER" },
      create: {
        companyId: LOCAL_TENANT.companyId,
        userId: user.id,
        role: "OWNER",
      },
    });

    await prisma.syncApiKey.upsert({
      where: { keyPrefix: LOCAL_SYNC_KEY_PREFIX },
      update: {
        companyId: LOCAL_TENANT.companyId,
        syncSourceId: LOCAL_TENANT.syncSourceId,
        name: "Local seed key",
        keyHash: hashString(LOCAL_SYNC_API_KEY),
        expiresAt: new Date("2099-12-31T23:59:59.000Z"),
        revokedAt: null,
      },
      create: {
        companyId: LOCAL_TENANT.companyId,
        syncSourceId: LOCAL_TENANT.syncSourceId,
        name: "Local seed key",
        keyPrefix: LOCAL_SYNC_KEY_PREFIX,
        keyHash: hashString(LOCAL_SYNC_API_KEY),
        expiresAt: new Date("2099-12-31T23:59:59.000Z"),
      },
    });

    console.log("Local database seeded successfully.");
    console.log(
      `Created ${bulkCounts.sales} sales, ${bulkCounts.purchases} purchases, ${bulkCounts.vouchers} payment vouchers, and ${bulkCounts.allocations} allocations across 2 accounting companies and 4 financial years.`,
    );
    console.log(`Login: ${LOCAL_LOGIN.email} / ${LOCAL_LOGIN.password}`);
    console.log(`Local sync API key: ${LOCAL_SYNC_API_KEY}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  BULK_ENTRY_COUNT_PER_TYPE,
  BULK_FINANCIAL_YEARS,
  LOCAL_ACCOUNTING_COMPANIES,
  LOCAL_LOGIN,
  LOCAL_TENANT,
  assertSafeSeedTarget,
  createBillData,
  createBulkSeedData,
  createVoucherData,
  isLocalDatabaseUrl,
};
