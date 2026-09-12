const outstandingQueries = require("../db/outstandingQueries");
const { DEFAULT_FINANCIAL_YEAR } = require("../utils/financialYear");

const SALES_CODE = "S";
const SALES_RETURN_CODES = ["SR"];
const BANK_RECEIPT_CODE = ["BR", "CR"];
const PURCHASE_CODES = ["P", "OP", "FJ"];
const PURCHASE_RETURN_CODES = ["PR", "FJR"];
const BANK_PAYMENT_CODE = ["BP", "CP"];

function toNumber(value) {
  return Number(value) || 0;
}

function createBillPartyKey(accountingCompanyId, billNo, party) {
  return JSON.stringify([
    String(accountingCompanyId || ""),
    String(billNo || "")
      .trim()
      .toUpperCase(),
    String(party || "")
      .trim()
      .toUpperCase(),
  ]);
}

function createBillEntryKey(accountingCompanyId, billEntrySourceId) {
  return JSON.stringify([
    String(accountingCompanyId || ""),
    String(billEntrySourceId ?? "").trim(),
  ]);
}

function createBillEntryNumberKey(
  accountingCompanyId,
  billEntrySourceId,
  billNo,
) {
  return JSON.stringify([
    String(accountingCompanyId || ""),
    String(billEntrySourceId ?? "").trim(),
    String(billNo ?? "").trim().toUpperCase(),
  ]);
}

function hasSourceId(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function getAccountingCompanyKey(record) {
  return record.accounting_company_key ?? record.accounting_company_id;
}

function getReturnAdjustmentKey(adjustment) {
  return JSON.stringify([
    String(adjustment.source_entry_id ?? "").trim(),
    String(adjustment.return_bill_entry_source_id ?? "").trim(),
  ]);
}

function mergeCarriedReturnAdjustments(entries, financialYear, returnCodes) {
  const reportEntries = [];
  const carriedEntries = [];

  for (const entry of entries) {
    if (!entry.financial_year || entry.financial_year === financialYear) {
      reportEntries.push({
        ...entry,
        return_adjustments: [...(entry.return_adjustments ?? [])],
      });
    } else if (entry.is_opening === true) {
      carriedEntries.push(entry);
    }
  }

  const entriesBySourceId = new Map();
  const entriesBySourceAndNumber = new Map();
  const adjustmentKeysByEntry = new Map();

  for (const entry of reportEntries) {
    if (returnCodes.includes(entry.code)) continue;
    if (!hasSourceId(entry.bill_entry_source_id)) continue;

    const companyKey = getAccountingCompanyKey(entry);
    const sourceKey = createBillEntryKey(
      companyKey,
      entry.bill_entry_source_id,
    );
    const sourceEntries = entriesBySourceId.get(sourceKey) || [];
    sourceEntries.push(entry);
    entriesBySourceId.set(sourceKey, sourceEntries);

    if (hasSourceId(entry.bill_no)) {
      entriesBySourceAndNumber.set(
        createBillEntryNumberKey(
          companyKey,
          entry.bill_entry_source_id,
          entry.bill_no,
        ),
        entry,
      );
    }

    adjustmentKeysByEntry.set(
      entry,
      new Set(entry.return_adjustments.map(getReturnAdjustmentKey)),
    );
  }

  for (const carriedEntry of carriedEntries) {
    if (returnCodes.includes(carriedEntry.code)) continue;
    if (!hasSourceId(carriedEntry.bill_entry_source_id)) continue;

    const companyKey = getAccountingCompanyKey(carriedEntry);
    let targetEntry;
    if (hasSourceId(carriedEntry.bill_no)) {
      targetEntry = entriesBySourceAndNumber.get(
        createBillEntryNumberKey(
          companyKey,
          carriedEntry.bill_entry_source_id,
          carriedEntry.bill_no,
        ),
      );
    } else {
      const sourceMatches = entriesBySourceId.get(
        createBillEntryKey(companyKey, carriedEntry.bill_entry_source_id),
      );
      if (sourceMatches?.length === 1) targetEntry = sourceMatches[0];
    }
    if (!targetEntry) continue;

    const adjustmentKeys = adjustmentKeysByEntry.get(targetEntry);
    for (const adjustment of carriedEntry.return_adjustments ?? []) {
      const adjustmentKey = getReturnAdjustmentKey(adjustment);
      if (adjustmentKeys.has(adjustmentKey)) continue;
      adjustmentKeys.add(adjustmentKey);
      targetEntry.return_adjustments.push(adjustment);
    }
  }

  return reportEntries;
}

function getPaymentDays(billDate, payment) {
  const paymentDate = payment.clearing_date || payment.cheque_date;
  if (!paymentDate) return null;

  const billTime = new Date(billDate).getTime();
  const paymentTime = new Date(paymentDate).getTime();
  if (Number.isNaN(billTime) || Number.isNaN(paymentTime)) return null;

  return Math.max(0, Math.round((paymentTime - billTime) / 86_400_000));
}

function addPaymentTiming(entry, payment) {
  const paymentDays = getPaymentDays(entry.billDate, payment);
  if (paymentDays === null) return;

  entry.totalPaymentDays += paymentDays;
  entry.paymentCount += 1;
  entry.averagePaymentDays = entry.totalPaymentDays / entry.paymentCount;
}

function createOutstandingEntry(entry, outstandingField) {
  const billAdjustmentAmount = (entry.return_adjustments ?? []).reduce(
    (total, adjustment) => total + toNumber(adjustment.adjusted_amount),
    0,
  );
  const billAmount = toNumber(entry.net_amount);
  const outstandingAmount = billAmount - billAdjustmentAmount;

  return {
    billEntrySourceId: entry.bill_entry_source_id,
    billNo: entry.bill_no,
    billDate: entry.bill_date,
    party: entry.party,
    code: entry.code,
    itemNames: entry.item_names ?? [],
    items: entry.items ?? [],
    billAmount,
    billAdjustmentAmount,
    adjustedAmount: billAdjustmentAmount,
    unadjustedAmount: 0,
    allocationBalance: 0,
    [outstandingField]: Math.max(0, outstandingAmount),
    overpaidAmount: Math.max(0, -outstandingAmount),
    totalPaymentDays: 0,
    paymentCount: 0,
    averagePaymentDays: null,
    payments: [],
  };
}

function addAllocation(entry, allocation, outstandingField) {
  const adjustedAmount = toNumber(allocation.adjust_amt);
  const outstandingAmount =
    entry.billAmount - (entry.adjustedAmount + adjustedAmount);

  entry.adjustedAmount += adjustedAmount;
  entry.unadjustedAmount += toNumber(allocation.unadj_amt);
  entry.allocationBalance += toNumber(allocation.bal_amt);
  entry[outstandingField] = Math.max(0, outstandingAmount);
  entry.overpaidAmount = Math.max(0, -outstandingAmount);
  addPaymentTiming(entry, allocation.payment_vouchers);
  entry.payments.push({
    mode: allocation.payment_vouchers.mode,
    party: allocation.payment_vouchers.party,
    chequeDate: allocation.payment_vouchers.cheque_date,
    clearingDate: allocation.payment_vouchers.clearing_date,
    netAmount: toNumber(allocation.payment_vouchers.net_amount),
    adjustedAmount,
    unadjustedAmount: toNumber(allocation.unadj_amt),
    allocationBalance: toNumber(allocation.bal_amt),
  });
}

function createPartySummary(party, type) {
  if (type === "sales") {
    return {
      party,
      totalSalesAmount: 0,
      totalAdjustedAmount: 0,
      totalSalesReturnAmount: 0,
      amountToCollect: 0,
    };
  }

  return {
    party,
    totalPurchaseAmount: 0,
    totalAdjustedAmount: 0,
    totalPurchaseReturnAmount: 0,
    amountToPay: 0,
  };
}

function buildOutstandingReport(entries, allocations, options) {
  const {
    transactionCodes,
    returnCodes,
    type,
    outstandingField,
    totalAmountField,
    totalReturnField,
    totalOutstandingField,
  } = options;
  const outstandingEntries = [];
  const entriesBySourceId = new Map();
  const entriesBySourceAndNumber = new Map();
  const entriesByBillAndParty = new Map();
  const returnTotalsByParty = new Map();
  const unallocatedReturnsByParty = new Map();
  const appliedReturnsBySourceId = new Map();

  for (const entry of entries) {
    for (const adjustment of entry.return_adjustments ?? []) {
      if (!hasSourceId(adjustment.return_bill_entry_source_id)) continue;

      const key = createBillEntryKey(
        getAccountingCompanyKey(entry),
        adjustment.return_bill_entry_source_id,
      );
      appliedReturnsBySourceId.set(
        key,
        (appliedReturnsBySourceId.get(key) || 0) +
          toNumber(adjustment.adjusted_amount),
      );
    }
  }

  for (const entry of entries) {
    if (returnCodes.includes(entry.code)) {
      const returnAmount = toNumber(entry.net_amount);
      const returnKey = createBillEntryKey(
        getAccountingCompanyKey(entry),
        entry.bill_entry_source_id,
      );
      const appliedReturnAmount = appliedReturnsBySourceId.get(returnKey) || 0;
      const unallocatedReturnAmount = Math.max(
        0,
        returnAmount - appliedReturnAmount,
      );

      returnTotalsByParty.set(
        entry.party,
        (returnTotalsByParty.get(entry.party) || 0) + returnAmount,
      );
      unallocatedReturnsByParty.set(
        entry.party,
        (unallocatedReturnsByParty.get(entry.party) || 0) +
          unallocatedReturnAmount,
      );
      continue;
    }

    if (!transactionCodes.includes(entry.code) && entry.code !== undefined) {
      continue;
    }
    if (!entry.bill_no) continue;

    const outstandingEntry = createOutstandingEntry(entry, outstandingField);
    outstandingEntries.push(outstandingEntry);

    if (hasSourceId(entry.bill_entry_source_id)) {
      const sourceKey = createBillEntryKey(
        getAccountingCompanyKey(entry),
        entry.bill_entry_source_id,
      );
      const sourceEntries = entriesBySourceId.get(sourceKey) || [];
      sourceEntries.push(outstandingEntry);
      entriesBySourceId.set(sourceKey, sourceEntries);
      entriesBySourceAndNumber.set(
        createBillEntryNumberKey(
          getAccountingCompanyKey(entry),
          entry.bill_entry_source_id,
          entry.bill_no,
        ),
        outstandingEntry,
      );
    }

    const legacyKey = createBillPartyKey(
      getAccountingCompanyKey(entry),
      entry.bill_no,
      entry.party,
    );
    const legacyEntries = entriesByBillAndParty.get(legacyKey) || [];
    legacyEntries.push(outstandingEntry);
    entriesByBillAndParty.set(legacyKey, legacyEntries);
  }

  for (const allocation of allocations) {
    let entry;
    if (hasSourceId(allocation.bill_entry_source_id)) {
      if (hasSourceId(allocation.bill_no)) {
        entry = entriesBySourceAndNumber.get(
          createBillEntryNumberKey(
            getAccountingCompanyKey(allocation),
            allocation.bill_entry_source_id,
            allocation.bill_no,
          ),
        );
      } else {
        const sourceMatches = entriesBySourceId.get(
          createBillEntryKey(
            getAccountingCompanyKey(allocation),
            allocation.bill_entry_source_id,
          ),
        );
        if (sourceMatches?.length === 1) entry = sourceMatches[0];
      }
    } else {
      const legacyMatches = entriesByBillAndParty.get(
        createBillPartyKey(
          getAccountingCompanyKey(allocation),
          allocation.bill_no,
          allocation.payment_vouchers.party,
        ),
      );
      if (legacyMatches?.length === 1) entry = legacyMatches[0];
    }

    if (entry) addAllocation(entry, allocation, outstandingField);
  }

  const data = outstandingEntries;
  const partySummaryByParty = new Map();
  const summary = data.reduce(
    (totals, entry) => {
      totals[totalAmountField] += entry.billAmount;
      totals.totalAdjustedAmount += entry.adjustedAmount;
      totals[totalOutstandingField] += entry[outstandingField];
      totals.totalOverpaidAmount += entry.overpaidAmount;
      totals.invoiceCount += 1;
      if (entry[outstandingField] === 0) totals.paidInvoiceCount += 1;
      else totals.outstandingInvoiceCount += 1;

      const partySummary =
        partySummaryByParty.get(entry.party) ||
        createPartySummary(entry.party, type);
      partySummary[totalAmountField] += entry.billAmount;
      partySummary.totalAdjustedAmount += entry.adjustedAmount;
      partySummary[outstandingField] += entry[outstandingField];
      partySummaryByParty.set(entry.party, partySummary);
      return totals;
    },
    {
      [totalAmountField]: 0,
      totalAdjustedAmount: 0,
      [totalReturnField]: 0,
      [totalOutstandingField]: 0,
      totalOverpaidAmount: 0,
      invoiceCount: 0,
      paidInvoiceCount: 0,
      outstandingInvoiceCount: 0,
    },
  );

  for (const [party, returnAmount] of returnTotalsByParty) {
    const partySummary =
      partySummaryByParty.get(party) || createPartySummary(party, type);
    partySummary[totalReturnField] += returnAmount;
    const unallocatedReturnAmount = unallocatedReturnsByParty.get(party) || 0;
    partySummary[outstandingField] = Math.max(
      0,
      partySummary[outstandingField] - unallocatedReturnAmount,
    );
    partySummaryByParty.set(party, partySummary);
  }

  summary[totalReturnField] = [...returnTotalsByParty.values()].reduce(
    (total, amount) => total + amount,
    0,
  );
  const partySummary = [...partySummaryByParty.values()].sort(
    (first, second) => second[outstandingField] - first[outstandingField],
  );
  summary[totalOutstandingField] = partySummary.reduce(
    (total, party) => total + party[outstandingField],
    0,
  );

  return { summary, data, partySummary };
}

async function getOutstandingReport(reportContext, options, financialYear) {
  const fetchedEntries = await outstandingQueries.findBillEntries(
    reportContext,
    [...options.transactionCodes, ...options.returnCodes],
    financialYear,
  );
  const entries = mergeCarriedReturnAdjustments(
    fetchedEntries,
    financialYear,
    options.returnCodes,
  );
  const billEntries = entries.filter(
    (entry) => !options.returnCodes.includes(entry.code) && entry.bill_no,
  );
  const billEntrySourceIds = [
    ...new Set(
      billEntries
        .map((entry) => entry.bill_entry_source_id)
        .filter(hasSourceId)
        .map(String),
    ),
  ];
  const billNumbers = [...new Set(billEntries.map((entry) => entry.bill_no))];
  const allocations =
    billEntrySourceIds.length === 0 && billNumbers.length === 0
      ? []
      : await outstandingQueries.findPaymentAllocations(
          reportContext,
          options.paymentCode,
          billEntrySourceIds,
          billNumbers,
          financialYear,
        );

  return buildOutstandingReport(entries, allocations, options);
}

async function getSales(
  reportContext,
  { financialYear = DEFAULT_FINANCIAL_YEAR } = {},
) {
  return getOutstandingReport(
    reportContext,
    {
      transactionCodes: [SALES_CODE],
      returnCodes: SALES_RETURN_CODES,
      paymentCode: BANK_RECEIPT_CODE,
      type: "sales",
      outstandingField: "amountToCollect",
      totalAmountField: "totalSalesAmount",
      totalReturnField: "totalSalesReturnAmount",
      totalOutstandingField: "totalToCollect",
    },
    financialYear,
  );
}

async function getPurchases(
  reportContext,
  { financialYear = DEFAULT_FINANCIAL_YEAR } = {},
) {
  return getOutstandingReport(
    reportContext,
    {
      transactionCodes: PURCHASE_CODES,
      returnCodes: PURCHASE_RETURN_CODES,
      paymentCode: BANK_PAYMENT_CODE,
      type: "purchases",
      outstandingField: "amountToPay",
      totalAmountField: "totalPurchaseAmount",
      totalReturnField: "totalPurchaseReturnAmount",
      totalOutstandingField: "totalToPay",
    },
    financialYear,
  );
}

module.exports = { getSales, getPurchases };
