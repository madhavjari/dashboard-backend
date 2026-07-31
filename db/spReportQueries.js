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

function mapItemSummary(item) {
  return {
    itemName: item.item_name,
    pcs: item._sum.pcs ?? 0,
    meters: item._sum.meters ?? 0,
    weight: item._sum.weight ?? 0,
    per: item.per,
    transaction: item._sum.final_amount ?? 0,
  };
}

async function getItemWiseSummary(fromDate, toDate, billCode, returnCode) {
  const billEntryFilter = createEntryDateFilter(billCode, fromDate, toDate);
  const returnEntryFilter = createEntryDateFilter(
    returnCode,
    fromDate,
    toDate,
  );

  const [summary, uniqueItems, topItems, returnItems] = await Promise.all([
    neonprisma.sales_items.aggregate({
      where: { sales_entries: billEntryFilter },
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
    neonprisma.sales_items.groupBy({
      by: ["item_name"],
      where: { sales_entries: billEntryFilter },
    }),
    neonprisma.sales_items.groupBy({
      by: ["item_name", "per"],
      where: { sales_entries: billEntryFilter },
      _sum: {
        pcs: true,
        meters: true,
        weight: true,
        amount: true,
        final_amount: true,
      },
      orderBy: { _sum: { final_amount: "desc" } },
    }),
    neonprisma.sales_items.groupBy({
      by: ["item_name", "per"],
      where: { sales_entries: returnEntryFilter },
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

  return {
    summary: {
      totalPcs: summary._sum.pcs ?? 0,
      totalMeters: summary._sum.meters ?? 0,
      totalWeight: summary._sum.weight ?? 0,
      totalTaxable: summary._sum.taxable ?? 0,
      totalTransaction: summary._sum.final_amount ?? 0,
      totalUniqueItems: uniqueItems.length ?? 0,
    },
    topItems: topItems.map(mapItemSummary),
    returnItems: returnItems.map(mapItemSummary),
  };
}

async function getKPI(fromDate, toDate, billCode, returnCode) {
  const [sales, salesReturns] = await Promise.all([
    neonprisma.sales_entries.aggregate({
      where: createEntryDateFilter(billCode, fromDate, toDate),
      _sum: {
        net_amount: true,
        cgst: true,
        sgst: true,
        igst: true,
      },
      _count: { entry_id: true },
    }),
    neonprisma.sales_entries.aggregate({
      where: createEntryDateFilter(returnCode, fromDate, toDate),
      _sum: {
        net_amount: true,
        cgst: true,
        sgst: true,
        igst: true,
      },
      _count: { entry_id: true },
    }),
  ]);
  const grossAmount = Number(sales._sum.net_amount ?? 0);

  const returns = Number(salesReturns._sum.net_amount ?? 0);

  const netAmount = grossAmount - returns;

  const invoiceCount = Number(sales._count.entry_id ?? 0);
  const returnCount = Number(salesReturns._count.entry_id ?? 0);
  const cgst = Number(sales._sum.cgst ?? 0);
  const sgst = Number(sales._sum.sgst ?? 0);
  const igst = Number(sales._sum.igst ?? 0);
  const cgstReturn = Number(salesReturns._sum.cgst ?? 0);
  const sgstReturn = Number(salesReturns._sum.sgst ?? 0);
  const igstReturn = Number(salesReturns._sum.igst ?? 0);
  const data = {
    grossAmount,
    returns,
    netAmount,
    invoiceCount,
    returnCount,
    cgst,
    igst,
    sgst,
    cgstReturn,
    sgstReturn,
    igstReturn,
  };
  return data;
}

async function getMonthlySales(fromDate, toDate, billCode, returnCode) {
  const billCodeSql = Prisma.join(billCode);
  const returnCodeSql = Prisma.join(returnCode);
  const allCodesSql = Prisma.join([...billCode, ...returnCode]);
  const result = await neonprisma.$queryRaw`
    SELECT
      DATE_TRUNC('month', bill_date) AS month,
      COALESCE(SUM(net_amount) FILTER (WHERE code IN (${billCodeSql})), 0) AS gross_amount,
      COALESCE(SUM(net_amount) FILTER (WHERE code IN (${returnCodeSql})), 0) AS return_amount
    FROM sales_entries
    WHERE code IN (${allCodesSql})
      AND bill_date >= ${fromDate}
      AND bill_date < ${toDate}
    GROUP BY DATE_TRUNC('month', bill_date)
    ORDER BY DATE_TRUNC('month', bill_date)
  `;

  return result.map((row) => {
    const grossAmount = Number(row.gross_amount);
    const returnAmount = Number(row.return_amount);
    return {
      month: row.month,
      grossAmount,
      returnAmount,
      netAmount: grossAmount - returnAmount,
    };
  });
}

async function getPartyDetails(
  fromDate,
  toDate,
  billCode,
  returnCode,
  mixCode,
  searchFilter = Prisma.empty,
) {
  const billCodeSql = Prisma.join(billCode);
  const returnCodeSql = Prisma.join(returnCode);
  const mixCodeSql = Prisma.join(mixCode);
  const result = await neonprisma.$queryRaw`
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
      WHERE code in (${mixCodeSql})
    ) AS invoice_count

  FROM sales_entries

  WHERE code in (${mixCodeSql})
    AND bill_date >= ${fromDate}
    AND bill_date < ${toDate}
    ${searchFilter}
  GROUP BY party

  ORDER BY net_sales DESC
`;
  return result.map((row) => ({
    party: row.party,
    grossAmount: Number(row.sales_amount),
    returnAmount: Number(row.return_amount),
    netAmount: Number(row.net_sales),
    invoiceCount: Number(row.invoice_count),
  }));
}

async function getIndividualPartyData(fromDate, toDate, context, data, filter) {
  const partyData = await neonprisma.sales_entries.findMany({
    where: {
      [context]: data,
      ...createEntryDateFilter(filter, fromDate, toDate),
    },
    select: {
      comp_no: true,
      code: true,
      bill_no: true,
      bill_date: true,
      party: true,
      agent: true,
      net_amount: true,
      sales_items: {
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

  return partyData.flatMap((row) =>
    row.sales_items.map((item) => ({
      compNo: row.comp_no,
      code: row.code,
      billNo: row.bill_no,
      billDate: row.bill_date,
      party: row.party,
      agent: row.agent,
      netAmount: row.net_amount,
      itemName: item.item_name,
      pcs: item.pcs,
      meters: item.meters,
      weight: item.weight,
      per: item.per,
      discount: item.discount,
      rate: item.rate,
      totalAmount: item.final_amount,
    })),
  );
}

async function getIndividualItemData(fromDate, toDate, itemName, filter) {
  const itemData = await neonprisma.sales_entries.findMany({
    where: {
      ...createEntryDateFilter(filter, fromDate, toDate),
      sales_items: {
        some: { item_name: itemName },
      },
    },
    select: {
      comp_no: true,
      code: true,
      bill_no: true,
      bill_date: true,
      party: true,
      sales_items: {
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

  return itemData.flatMap((row) =>
    row.sales_items.map((item) => ({
      compNo: row.comp_no,
      code: row.code,
      billNo: row.bill_no,
      billDate: row.bill_date,
      party: row.party,
      itemName: item.item_name,
      pcs: item.pcs,
      meters: item.meters,
      weight: item.weight,
      per: item.per,
      totalAmount: item.final_amount,
    })),
  );
}

function toNumber(value) {
  return Number(value) || 0;
}

function getIndividualItemSummary(transactions, returnCodes) {
  const summary = transactions.reduce(
    (totals, transaction) => {
      const amount = toNumber(transaction.totalAmount);
      if (returnCodes.includes(transaction.code)) {
        totals.returnAmount += amount;
        return totals;
      }

      totals.grossAmount += amount;
      totals.totalPcs += toNumber(transaction.pcs);
      totals.totalMeters += toNumber(transaction.meters);
      totals.totalWeight += toNumber(transaction.weight);
      return totals;
    },
    {
      grossAmount: 0,
      returnAmount: 0,
      netAmount: 0,
      totalPcs: 0,
      totalMeters: 0,
      totalWeight: 0,
    },
  );

  summary.netAmount = summary.grossAmount - summary.returnAmount;
  return summary;
}

async function getIndividualItemDetails(
  fromDate,
  toDate,
  itemName,
  billCodes,
  returnCodes,
) {
  const data = await getIndividualItemData(fromDate, toDate, itemName, [
    ...billCodes,
    ...returnCodes,
  ]);

  return {
    data,
    summary: [getIndividualItemSummary(data, returnCodes)],
  };
}

module.exports = {
  getItemWiseSummary,
  getPartyDetails,
  getKPI,
  getMonthlySales,
  getIndividualPartyData,
  getIndividualItemDetails,
};
