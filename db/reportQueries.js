const { prisma } = require("../lib/prisma.js");
const { Prisma } = require("../generated/prisma/client.js");
const {
  createCompanyWhere,
  createCompanySql,
} = require("./reportScope");
const { financialYearFromPeriod } = require("../utils/financialYear");

function createEntryDateFilter(reportContext, codes, fromDate, toDate) {
  return {
    ...createCompanyWhere(reportContext),
    financialYear: financialYearFromPeriod(fromDate, toDate),
    isOpening: false,
    code: { in: codes },
    billDate: {
      gte: new Date(fromDate),
      lt: new Date(toDate),
    },
  };
}

function mapItemGroup(row) {
  return {
    item_name: row.itemName,
    per: row.per,
    _sum: {
      pcs: row._sum.pcs,
      meters: row._sum.meters,
      weight: row._sum.weight,
      amount: row._sum.amount,
      final_amount: row._sum.finalAmount,
    },
  };
}

async function findItemSummaryData(
  reportContext,
  fromDate,
  toDate,
  billCodes,
  returnCodes,
) {
  const companyWhere = createCompanyWhere(reportContext);
  const billEntryFilter = createEntryDateFilter(
    reportContext,
    billCodes,
    fromDate,
    toDate,
  );
  const returnEntryFilter = createEntryDateFilter(
    reportContext,
    returnCodes,
    fromDate,
    toDate,
  );

  const [summary, uniqueItems, topItems, returnItems] = await Promise.all([
    prisma.billItem.aggregate({
      where: {
        ...companyWhere,
        billEntry: billEntryFilter,
      },
      _sum: {
        pcs: true,
        meters: true,
        weight: true,
        amount: true,
        taxableAmount: true,
        finalAmount: true,
      },
      _count: { id: true },
    }),
    prisma.billItem.groupBy({
      by: ["itemName"],
      where: {
        ...companyWhere,
        billEntry: billEntryFilter,
      },
    }),
    prisma.billItem.groupBy({
      by: ["itemName", "per"],
      where: {
        ...companyWhere,
        billEntry: billEntryFilter,
      },
      _sum: {
        pcs: true,
        meters: true,
        weight: true,
        amount: true,
        finalAmount: true,
      },
      orderBy: { _sum: { finalAmount: "desc" } },
    }),
    prisma.billItem.groupBy({
      by: ["itemName", "per"],
      where: {
        ...companyWhere,
        billEntry: returnEntryFilter,
      },
      _sum: {
        pcs: true,
        meters: true,
        weight: true,
        amount: true,
        finalAmount: true,
      },
      orderBy: { _sum: { finalAmount: "desc" } },
    }),
  ]);

  return {
    summary: {
      _sum: {
        pcs: summary._sum.pcs,
        meters: summary._sum.meters,
        weight: summary._sum.weight,
        amount: summary._sum.amount,
        taxable: summary._sum.taxableAmount,
        final_amount: summary._sum.finalAmount,
      },
      _count: summary._count,
    },
    uniqueItems: uniqueItems.map((row) => ({
      item_name: row.itemName,
    })),
    topItems: topItems.map(mapItemGroup),
    returnItems: returnItems.map(mapItemGroup),
  };
}

function mapBillAggregate(result) {
  return {
    _sum: {
      net_amount: result._sum.netAmount,
      cgst: result._sum.cgst,
      sgst: result._sum.sgst,
      igst: result._sum.igst,
    },
    _count: {
      entry_id: result._count.entryId,
    },
  };
}

async function findKpiData(
  reportContext,
  fromDate,
  toDate,
  billCodes,
  returnCodes,
) {
  const [bills, returns] = await Promise.all([
    prisma.billEntry.aggregate({
      where: createEntryDateFilter(
        reportContext,
        billCodes,
        fromDate,
        toDate,
      ),
      _sum: {
        netAmount: true,
        cgst: true,
        sgst: true,
        igst: true,
      },
      _count: { entryId: true },
    }),
    prisma.billEntry.aggregate({
      where: createEntryDateFilter(
        reportContext,
        returnCodes,
        fromDate,
        toDate,
      ),
      _sum: {
        netAmount: true,
        cgst: true,
        sgst: true,
        igst: true,
      },
      _count: { entryId: true },
    }),
  ]);

  return {
    bills: mapBillAggregate(bills),
    returns: mapBillAggregate(returns),
  };
}

async function findMonthlyReportRows(
  reportContext,
  fromDate,
  toDate,
  billCodes,
  returnCodes,
) {
  const companySql = createCompanySql(reportContext, Prisma);
  const financialYear = financialYearFromPeriod(fromDate, toDate);
  const billCodeSql = Prisma.join(billCodes);
  const returnCodeSql = Prisma.join(returnCodes);
  const allCodesSql = Prisma.join([...billCodes, ...returnCodes]);

  return prisma.$queryRaw`
    SELECT
      DATE_TRUNC('month', "billDate") AS month,
      COALESCE(
        SUM("netAmount") FILTER (WHERE code IN (${billCodeSql})),
        0
      ) AS gross_amount,
      COALESCE(
        SUM("netAmount") FILTER (WHERE code IN (${returnCodeSql})),
        0
      ) AS return_amount
    FROM "BillEntry"
    WHERE ${companySql}
      AND "financialYear" = ${financialYear}
      AND "isOpening" = false
      AND code IN (${allCodesSql})
      AND "billDate" >= ${fromDate}
      AND "billDate" < ${toDate}
    GROUP BY DATE_TRUNC('month', "billDate")
    ORDER BY DATE_TRUNC('month', "billDate")
  `;
}

async function findPartySummaryRows(
  reportContext,
  fromDate,
  toDate,
  billCodes,
  returnCodes,
  allCodes,
  party,
) {
  const companySql = createCompanySql(reportContext, Prisma);
  const financialYear = financialYearFromPeriod(fromDate, toDate);
  const billCodeSql = Prisma.join(billCodes);
  const returnCodeSql = Prisma.join(returnCodes);
  const allCodesSql = Prisma.join(allCodes);
  const partyFilter = party
    ? Prisma.sql`AND party = ${party}`
    : Prisma.empty;

  return prisma.$queryRaw`
    SELECT
      party,
      COALESCE(
        SUM("netAmount") FILTER (WHERE code IN (${billCodeSql})),
        0
      ) AS sales_amount,
      COALESCE(
        SUM("netAmount") FILTER (WHERE code IN (${returnCodeSql})),
        0
      ) AS return_amount,
      COALESCE(
        SUM("netAmount") FILTER (WHERE code IN (${billCodeSql})),
        0
      )
      -
      COALESCE(
        SUM("netAmount") FILTER (WHERE code IN (${returnCodeSql})),
        0
      ) AS net_sales,
      COUNT(*) FILTER (WHERE code IN (${allCodesSql})) AS invoice_count
    FROM "BillEntry"
    WHERE ${companySql}
      AND "financialYear" = ${financialYear}
      AND "isOpening" = false
      AND code IN (${allCodesSql})
      AND "billDate" >= ${fromDate}
      AND "billDate" < ${toDate}
      ${partyFilter}
    GROUP BY party
    ORDER BY net_sales DESC
  `;
}

function mapBillItem(item) {
  return {
    item_name: item.itemName,
    pcs: item.pcs,
    meters: item.meters,
    weight: item.weight,
    per: item.per,
    discount: item.discountAmount,
    rate: item.rate,
    final_amount: item.finalAmount,
  };
}

function mapBillTransaction(row) {
  return {
    accounting_company_id: row.accountingCompanyId,
    comp_no: row.compNo,
    code: row.code,
    bill_no: row.billNo,
    bill_date: row.billDate,
    party: row.party,
    agent: row.agent,
    net_amount: row.netAmount,
    bill_data: row.items.map(mapBillItem),
  };
}

async function findPartyTransactions(
  reportContext,
  fromDate,
  toDate,
  field,
  value,
  codes,
) {
  const fieldMap = {
    party: "party",
    partyCode: "partyCode",
  };
  const modelField = fieldMap[field];
  if (!modelField) throw new Error("Unsupported party lookup field");

  const rows = await prisma.billEntry.findMany({
    where: {
      ...createEntryDateFilter(reportContext, codes, fromDate, toDate),
      [modelField]: value,
    },
    select: {
      accountingCompanyId: true,
      compNo: true,
      code: true,
      billNo: true,
      billDate: true,
      party: true,
      agent: true,
      netAmount: true,
      items: {
        select: {
          itemName: true,
          pcs: true,
          meters: true,
          weight: true,
          per: true,
          discountAmount: true,
          rate: true,
          finalAmount: true,
        },
      },
    },
    orderBy: { billDate: "desc" },
  });

  return rows.map(mapBillTransaction);
}

async function findItemTransactions(
  reportContext,
  fromDate,
  toDate,
  itemName,
  codes,
) {
  const rows = await prisma.billEntry.findMany({
    where: {
      ...createEntryDateFilter(reportContext, codes, fromDate, toDate),
      items: {
        some: { itemName },
      },
    },
    select: {
      accountingCompanyId: true,
      compNo: true,
      code: true,
      billNo: true,
      billDate: true,
      party: true,
      items: {
        where: { itemName },
        select: {
          itemName: true,
          pcs: true,
          meters: true,
          weight: true,
          per: true,
          finalAmount: true,
        },
      },
    },
    orderBy: { billDate: "desc" },
  });

  return rows.map(mapBillTransaction);
}

module.exports = {
  findItemSummaryData,
  findKpiData,
  findMonthlyReportRows,
  findPartySummaryRows,
  findPartyTransactions,
  findItemTransactions,
};
