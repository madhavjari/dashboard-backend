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
  const syncSourceId = accountingCompany?.syncSourceId;
  const name = String(accountingCompany?.name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase();

  if (companyId && syncSourceId && name) {
    // Accounting-company IDs can change after an annual rollover. The source
    // plus normalized name remains stable without crossing sync computers.
    return JSON.stringify([companyId, syncSourceId, name]);
  }

  if (companyId && name) {
    return JSON.stringify([companyId, name]);
  }

  return fallbackId;
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

async function findRelatedBillEntries(
  reportContext,
  codes,
  financialYear,
  billEntrySourceIds,
  billNumbers,
) {
  const sourceIds = [
    ...new Set(billEntrySourceIds.filter(Boolean).map(String)),
  ];
  const normalizedBillNumbers = [
    ...new Set(billNumbers.filter(Boolean).map(String)),
  ];
  if (sourceIds.length === 0 || normalizedBillNumbers.length === 0) return [];

  const rows = await prisma.billEntry.findMany({
    where: {
      ...createCompanyWhere(reportContext),
      // Do not apply the selected accountingCompanyId here: each annual
      // database can register the same company under a different ID.
      financialYear: { not: financialYear },
      code: { in: codes },
      entryId: { in: sourceIds },
      billNo: { in: normalizedBillNumbers },
      returnAdjustments: { some: {} },
    },
    select: {
      companyId: true,
      accountingCompanyId: true,
      accountingCompany: {
        select: { syncSourceId: true, name: true },
      },
      financialYear: true,
      isOpening: true,
      entryId: true,
      code: true,
      billNo: true,
      party: true,
      returnAdjustments: {
        select: {
          sourceEntryId: true,
          returnBillEntryId: true,
          adjustedAmount: true,
        },
      },
    },
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
    party: row.party,
    return_adjustments: (row.returnAdjustments ?? []).map((adjustment) => ({
      source_entry_id: adjustment.sourceEntryId,
      return_bill_entry_source_id: adjustment.returnBillEntryId,
      adjusted_amount: adjustment.adjustedAmount,
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
  if (linkFilters.length === 0) return [];

  const rows = await prisma.paymentAllocation.findMany({
    where: {
      ...createCompanyWhere(reportContext),
      code: { in: codes },
      OR: linkFilters,
    },
    select: {
      billNo: true,
      billEntrySourceId: true,
      allocationDate: true,
      adjustedAmount: true,
      unadjustedAmount: true,
      balanceAmount: true,
      paymentVoucher: {
        select: {
          companyId: true,
          accountingCompanyId: true,
          financialYear: true,
          isOpening: true,
          entryId: true,
          accountingCompany: {
            select: { syncSourceId: true, name: true },
          },
          voucherDate: true,
          mode: true,
          party: true,
          slipNo: true,
          referenceNo: true,
          chequeNo: true,
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
    allocation_date: row.allocationDate,
    adjust_amt: row.adjustedAmount,
    unadj_amt: row.unadjustedAmount,
    bal_amt: row.balanceAmount,
    payment_vouchers: {
      financial_year: row.paymentVoucher.financialYear,
      is_opening: row.paymentVoucher.isOpening,
      source_entry_id: row.paymentVoucher.entryId,
      voucher_date: row.paymentVoucher.voucherDate,
      mode: row.paymentVoucher.mode,
      party: row.paymentVoucher.party,
      slip_no: row.paymentVoucher.slipNo,
      reference_no: row.paymentVoucher.referenceNo,
      cheque_no: row.paymentVoucher.chequeNo,
      cheque_date: row.paymentVoucher.chequeDate,
      clearing_date: row.paymentVoucher.clearingDate,
      net_amount: row.paymentVoucher.netAmount,
    },
  }));
}

module.exports = {
  findBillEntries,
  findRelatedBillEntries,
  findPaymentAllocations,
};
