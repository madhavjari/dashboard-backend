const { prisma } = require("../lib/prisma.js");
const {
  createAccountingCompanyWhere,
  createCompanyWhere,
} = require("./reportScope");

function toNumber(value) {
  return Number(value) || 0;
}

function createAccountingCompanyKey(
  accountingCompany,
  fallbackId,
  ownerCompanyId,
) {
  const companyId = ownerCompanyId || accountingCompany?.companyId;
  const name = String(accountingCompany?.name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase();

  if (companyId && name) {
    return JSON.stringify([companyId, name]);
  }

  return fallbackId;
}

async function findBillEntries(reportContext, codes, financialYear) {
  const accountingCompanyWhere =
    createAccountingCompanyWhere(reportContext);
  const rows = await prisma.billEntry.findMany({
    where: {
      ...createCompanyWhere(reportContext),
      code: { in: codes },
      OR: [
        { financialYear, ...accountingCompanyWhere },
        // A return created after rollover is linked to the opening copy of
        // the original bill in the later yearly database. Fetch that copy so
        // its return link can be reconciled with the selected-year invoice.
        { financialYear: { gt: financialYear }, isOpening: true },
      ],
    },
    select: {
      companyId: true,
      accountingCompanyId: true,
      financialYear: true,
      isOpening: true,
      accountingCompany: {
        select: { syncSourceId: true, name: true },
      },
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
        select: {
          itemName: true,
          pcs: true,
          meters: true,
          weight: true,
          per: true,
        },
      },
    },
    orderBy: { billDate: "desc" },
  });

  return rows.map((row) => ({
    accounting_company_id: row.accountingCompanyId,
    accounting_company_key: createAccountingCompanyKey(
      row.accountingCompany,
      row.accountingCompanyId,
      row.companyId,
    ),
    financial_year: row.financialYear,
    is_opening: row.isOpening,
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
  financialYear,
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
        // A bill can be settled in a later financial year, but a voucher from
        // an earlier year cannot belong to the selected-year bill. Excluding
        // earlier vouchers also prevents reused source IDs and bill numbers
        // from being counted against the wrong invoice.
        financialYear: { gte: financialYear },
        // Opening vouchers in the selected year represent payments already
        // carried into that year's opening balance and must be applied. An
        // opening voucher in a later year is a carried copy of state already
        // counted in an earlier year, so only real vouchers are taken later.
        OR: [{ financialYear }, { isOpening: false }],
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
          companyId: true,
          accountingCompanyId: true,
          accountingCompany: {
            select: { syncSourceId: true, name: true },
          },
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
    accounting_company_key: createAccountingCompanyKey(
      row.paymentVoucher.accountingCompany,
      row.paymentVoucher.accountingCompanyId,
      row.paymentVoucher.companyId,
    ),
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
