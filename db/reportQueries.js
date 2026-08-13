const { neonprisma } = require("../lib/neon.js");
const { Prisma } = require("../generated/neon/client.js");

function createEntryDateFilter(codes, fromDate, toDate) {
  return {
    code: { in: codes },
    bill_date: {
      gte: new Date(fromDate),
      lt: new Date(toDate),
    },
  };
}

async function findItemSummaryData(fromDate, toDate, billCodes, returnCodes) {
  const billEntryFilter = createEntryDateFilter(billCodes, fromDate, toDate);
  const returnEntryFilter = createEntryDateFilter(
    returnCodes,
    fromDate,
    toDate,
  );

  const [summary, uniqueItems, topItems, returnItems] = await Promise.all([
    neonprisma.bill_data.aggregate({
      where: { bill_entries: billEntryFilter },
      _sum: {
        pcs: true,
        meters: true,
        weight: true,
        amount: true,
        taxable: true,
        final_amount: true,
      },
      _count: { id: true },
    }),
    neonprisma.bill_data.groupBy({
      by: ["item_name"],
      where: { bill_entries: billEntryFilter },
    }),
    neonprisma.bill_data.groupBy({
      by: ["item_name", "per"],
      where: { bill_entries: billEntryFilter },
      _sum: {
        pcs: true,
        meters: true,
        weight: true,
        amount: true,
        final_amount: true,
      },
      orderBy: { _sum: { final_amount: "desc" } },
    }),
    neonprisma.bill_data.groupBy({
      by: ["item_name", "per"],
      where: { bill_entries: returnEntryFilter },
      _sum: {
        pcs: true,
        meters: true,
        weight: true,
        amount: true,
        final_amount: true,
      },
      orderBy: { _sum: { final_amount: "desc" } },
    }),
  ]);

  return { summary, uniqueItems, topItems, returnItems };
}

async function findKpiData(fromDate, toDate, billCodes, returnCodes) {
  const [bills, returns] = await Promise.all([
    neonprisma.bill_entries.aggregate({
      where: createEntryDateFilter(billCodes, fromDate, toDate),
      _sum: {
        net_amount: true,
        cgst: true,
        sgst: true,
        igst: true,
      },
      _count: { entry_id: true },
    }),
    neonprisma.bill_entries.aggregate({
      where: createEntryDateFilter(returnCodes, fromDate, toDate),
      _sum: {
        net_amount: true,
        cgst: true,
        sgst: true,
        igst: true,
      },
      _count: { entry_id: true },
    }),
  ]);

  return { bills, returns };
}

async function findMonthlyReportRows(fromDate, toDate, billCodes, returnCodes) {
  const billCodeSql = Prisma.join(billCodes);
  const returnCodeSql = Prisma.join(returnCodes);
  const allCodesSql = Prisma.join([...billCodes, ...returnCodes]);

  return neonprisma.$queryRaw`
    SELECT
      DATE_TRUNC('month', bill_date) AS month,
      COALESCE(SUM(net_amount) FILTER (WHERE code IN (${billCodeSql})), 0) AS gross_amount,
      COALESCE(SUM(net_amount) FILTER (WHERE code IN (${returnCodeSql})), 0) AS return_amount
    FROM bill_entries
    WHERE code IN (${allCodesSql})
      AND bill_date >= ${fromDate}
      AND bill_date < ${toDate}
    GROUP BY DATE_TRUNC('month', bill_date)
    ORDER BY DATE_TRUNC('month', bill_date)
  `;
}

async function findPartySummaryRows(
  fromDate,
  toDate,
  billCodes,
  returnCodes,
  allCodes,
  party,
) {
  const billCodeSql = Prisma.join(billCodes);
  const returnCodeSql = Prisma.join(returnCodes);
  const allCodesSql = Prisma.join(allCodes);
  const partyFilter = party ? Prisma.sql`AND party = ${party}` : Prisma.empty;

  return neonprisma.$queryRaw`
    SELECT
      party,
      COALESCE(
        SUM(net_amount) FILTER (
          WHERE code in (${billCodeSql})
        ),
        0
      ) AS sales_amount,
      COALESCE(
        SUM(net_amount) FILTER (
          WHERE code in (${returnCodeSql})
        ),
        0
      ) AS return_amount,
      COALESCE(
        SUM(net_amount) FILTER (
          WHERE code in (${billCodeSql})
        ),
        0
      )
      -
      COALESCE(
        SUM(net_amount) FILTER (
          WHERE code in (${returnCodeSql})
        ),
        0
      ) AS net_sales,
      COUNT(*) FILTER (
        WHERE code in (${allCodesSql})
      ) AS invoice_count
    FROM bill_entries
    WHERE code in (${allCodesSql})
      AND bill_date >= ${fromDate}
      AND bill_date < ${toDate}
      ${partyFilter}
    GROUP BY party
    ORDER BY net_sales DESC
  `;
}

async function findPartyTransactions(fromDate, toDate, field, value, codes) {
  return neonprisma.bill_entries.findMany({
    where: {
      [field]: value,
      ...createEntryDateFilter(codes, fromDate, toDate),
    },
    select: {
      comp_no: true,
      code: true,
      bill_no: true,
      bill_date: true,
      party: true,
      agent: true,
      net_amount: true,
      bill_data: {
        select: {
          item_name: true,
          pcs: true,
          meters: true,
          weight: true,
          per: true,
          discount: true,
          rate: true,
          final_amount: true,
        },
      },
    },
    orderBy: { bill_date: "desc" },
  });
}

async function findItemTransactions(fromDate, toDate, itemName, codes) {
  return neonprisma.bill_entries.findMany({
    where: {
      ...createEntryDateFilter(codes, fromDate, toDate),
      bill_data: {
        some: { item_name: itemName },
      },
    },
    select: {
      comp_no: true,
      code: true,
      bill_no: true,
      bill_date: true,
      party: true,
      bill_data: {
        where: { item_name: itemName },
        select: {
          item_name: true,
          pcs: true,
          meters: true,
          weight: true,
          per: true,
          final_amount: true,
        },
      },
    },
    orderBy: { bill_date: "desc" },
  });
}

module.exports = {
  findItemSummaryData,
  findKpiData,
  findMonthlyReportRows,
  findPartySummaryRows,
  findPartyTransactions,
  findItemTransactions,
};
