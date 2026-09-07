const { prisma } = require("../lib/prisma.js");
const {
  createAccountingCompanyWhere,
  createCompanyWhere,
} = require("./reportScope");

function toNumber(value) {
  return Number(value) || 0;
}

async function findBillEntries(reportContext, codes, financialYear) {
  const rows = await prisma.billEntry.findMany({
    where: {
      ...createCompanyWhere(reportContext),
      ...createAccountingCompanyWhere(reportContext),
      financialYear,
      code: { in: codes },
    },
    select: {
      accountingCompanyId: true,
      entryId: true,
      code: true,
      billNo: true,
      billDate: true,
      party: true,
      netAmount: true,
      returnAdjustments: {
        select: {
          sourceEntryId: true,
          returnBillEntryId: true,
          adjustedAmount: true,
        },
      },
      items: {
        select: { itemName: true, pcs: true, meters: true, weight: true, per: true },
      },
    },
    orderBy: { billDate: "desc" },
  });

  return rows.map((row) => ({
    accounting_company_id: row.accountingCompanyId,
    bill_entry_source_id: row.entryId,
    code: row.code,
    bill_no: row.billNo,
    bill_date: row.billDate,
    party: row.party,
    net_amount: row.netAmount,
    return_adjustments: (row.returnAdjustments ?? []).map((adjustment) => ({
      source_entry_id: adjustment.sourceEntryId,
      return_bill_entry_source_id: adjustment.returnBillEntryId,
      adjusted_amount: adjustment.adjustedAmount,
    })),
    item_names: [
      ...new Set(row.items.map((item) => item.itemName).filter(Boolean)),
    ],
    items: row.items.map((item) => ({
      item_name: item.itemName,
      pcs: toNumber(item.pcs),
      meters: toNumber(item.meters),
      weight: toNumber(item.weight),
      per: item.per,
    })),
  }));
}

async function findPaymentAllocations(
  reportContext,
  codes,
  billEntrySourceIds,
  billNumbers,
) {
  const sourceIds = [
    ...new Set(billEntrySourceIds.filter(Boolean).map(String)),
  ];
  const legacyBillNumbers = [...new Set(billNumbers.filter(Boolean))];
  const linkFilters = [];

  if (sourceIds.length > 0) {
    linkFilters.push({ billEntrySourceId: { in: sourceIds } });
  }
  if (legacyBillNumbers.length > 0) {
    linkFilters.push({
      billEntrySourceId: null,
      billNo: { in: legacyBillNumbers },
    });
  }

  const rows = await prisma.paymentAllocation.findMany({
    where: {
      ...createCompanyWhere(reportContext),
      code: { in: codes },
      OR: linkFilters,
      paymentVoucher: {
        ...createAccountingCompanyWhere(reportContext),
      },
    },
    select: {
      billNo: true,
      billEntrySourceId: true,
      adjustedAmount: true,
      unadjustedAmount: true,
      balanceAmount: true,
      paymentVoucher: {
        select: {
          accountingCompanyId: true,
          mode: true,
          party: true,
          chequeDate: true,
          clearingDate: true,
          netAmount: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    accounting_company_id: row.paymentVoucher.accountingCompanyId,
    bill_entry_source_id: row.billEntrySourceId,
    bill_no: row.billNo,
    adjust_amt: row.adjustedAmount,
    unadj_amt: row.unadjustedAmount,
    bal_amt: row.balanceAmount,
    payment_vouchers: {
      mode: row.paymentVoucher.mode,
      party: row.paymentVoucher.party,
      cheque_date: row.paymentVoucher.chequeDate,
      clearing_date: row.paymentVoucher.clearingDate,
      net_amount: row.paymentVoucher.netAmount,
    },
  }));
}

module.exports = { findBillEntries, findPaymentAllocations };
