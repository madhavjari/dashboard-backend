const reportQueries = require("../db/reportQueries");

function toNumber(value) {
  return Number(value) || 0;
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

function flattenPartyTransactions(rows) {
  return rows.flatMap((row) =>
    row.bill_data.map((item) => ({
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

function flattenItemTransactions(rows) {
  return rows.flatMap((row) =>
    row.bill_data.map((item) => ({
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

async function getItemWiseSummary(
  reportContext,
  fromDate,
  toDate,
  billCodes,
  returnCodes,
) {
  const { summary, uniqueItems, topItems, returnItems } =
    await reportQueries.findItemSummaryData(
      reportContext,
      fromDate,
      toDate,
      billCodes,
      returnCodes,
    );

  return {
    summary: {
      totalPcs: summary._sum.pcs ?? 0,
      totalMeters: summary._sum.meters ?? 0,
      totalWeight: summary._sum.weight ?? 0,
      totalTaxable: summary._sum.taxable ?? 0,
      totalTransaction: summary._sum.final_amount ?? 0,
      totalUniqueItems: uniqueItems.length,
    },
    topItems: topItems.map(mapItemSummary),
    returnItems: returnItems.map(mapItemSummary),
  };
}

async function getKPI(reportContext, fromDate, toDate, billCodes, returnCodes) {
  const { bills, returns } = await reportQueries.findKpiData(
    reportContext,
    fromDate,
    toDate,
    billCodes,
    returnCodes,
  );
  const grossAmount = toNumber(bills._sum.net_amount);
  const returnAmount = toNumber(returns._sum.net_amount);

  return {
    grossAmount,
    returns: returnAmount,
    netAmount: grossAmount - returnAmount,
    invoiceCount: toNumber(bills._count.entry_id),
    returnCount: toNumber(returns._count.entry_id),
    cgst: toNumber(bills._sum.cgst),
    igst: toNumber(bills._sum.igst),
    sgst: toNumber(bills._sum.sgst),
    cgstReturn: toNumber(returns._sum.cgst),
    sgstReturn: toNumber(returns._sum.sgst),
    igstReturn: toNumber(returns._sum.igst),
  };
}

async function getMonthlySales(
  reportContext,
  fromDate,
  toDate,
  billCodes,
  returnCodes,
) {
  const rows = await reportQueries.findMonthlyReportRows(
    reportContext,
    fromDate,
    toDate,
    billCodes,
    returnCodes,
  );

  return rows.map((row) => {
    const grossAmount = toNumber(row.gross_amount);
    const returnAmount = toNumber(row.return_amount);

    return {
      month: row.month,
      grossAmount,
      returnAmount,
      netAmount: grossAmount - returnAmount,
    };
  });
}

async function getPartyDetails(
  reportContext,
  fromDate,
  toDate,
  billCodes,
  returnCodes,
  allCodes,
  party,
) {
  const rows = await reportQueries.findPartySummaryRows(
    reportContext,
    fromDate,
    toDate,
    billCodes,
    returnCodes,
    allCodes,
    party,
  );

  return rows.map((row) => ({
    party: row.party,
    grossAmount: toNumber(row.sales_amount),
    returnAmount: toNumber(row.return_amount),
    netAmount: toNumber(row.net_sales),
    invoiceCount: toNumber(row.invoice_count),
  }));
}

async function getIndividualPartyData(
  reportContext,
  fromDate,
  toDate,
  field,
  value,
  codes,
) {
  const rows = await reportQueries.findPartyTransactions(
    reportContext,
    fromDate,
    toDate,
    field,
    value,
    codes,
  );

  return flattenPartyTransactions(rows);
}

async function getIndividualItemDetails(
  reportContext,
  fromDate,
  toDate,
  itemName,
  billCodes,
  returnCodes,
) {
  const rows = await reportQueries.findItemTransactions(
    reportContext,
    fromDate,
    toDate,
    itemName,
    [...billCodes, ...returnCodes],
  );
  const data = flattenItemTransactions(rows);

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
