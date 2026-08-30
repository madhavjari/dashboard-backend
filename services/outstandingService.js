const outstandingQueries = require("../db/outstandingQueries");
const { DEFAULT_FINANCIAL_YEAR } = require("../utils/financialYear");

const SALES_CODE = "S";
const SALES_RETURN_CODES = ["SR"];
const BANK_RECEIPT_CODE = "BR";
const PURCHASE_CODES = ["P", "OP", "FJ"];
const PURCHASE_RETURN_CODES = ["PR", "FJR"];
const BANK_PAYMENT_CODE = "BP";

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
  return {
    billNo: entry.bill_no,
    billDate: entry.bill_date,
    party: entry.party,
    billAmount: toNumber(entry.net_amount),
    adjustedAmount: 0,
    unadjustedAmount: 0,
    allocationBalance: 0,
    [outstandingField]: toNumber(entry.net_amount),
    overpaidAmount: 0,
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
  const entriesByBillAndParty = new Map();
  const returnsByParty = new Map();

  for (const entry of entries) {
    if (returnCodes.includes(entry.code)) {
      returnsByParty.set(
        entry.party,
        (returnsByParty.get(entry.party) || 0) + toNumber(entry.net_amount),
      );
      continue;
    }

    if (!transactionCodes.includes(entry.code) && entry.code !== undefined) {
      continue;
    }
    if (!entry.bill_no) continue;

    const key = createBillPartyKey(
      entry.accounting_company_id,
      entry.bill_no,
      entry.party,
    );
    const existingEntry = entriesByBillAndParty.get(key);
    if (existingEntry) {
      existingEntry.billAmount += toNumber(entry.net_amount);
      existingEntry[outstandingField] =
        existingEntry.billAmount - existingEntry.adjustedAmount;
      continue;
    }

    entriesByBillAndParty.set(
      key,
      createOutstandingEntry(entry, outstandingField),
    );
  }

  for (const allocation of allocations) {
    const entry = entriesByBillAndParty.get(
      createBillPartyKey(
        allocation.accounting_company_id,
        allocation.bill_no,
        allocation.payment_vouchers.party,
      ),
    );
    if (entry) addAllocation(entry, allocation, outstandingField);
  }

  const data = [...entriesByBillAndParty.values()];
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

  for (const [party, returnAmount] of returnsByParty) {
    const partySummary =
      partySummaryByParty.get(party) || createPartySummary(party, type);
    partySummary[totalReturnField] += returnAmount;
    partySummary[outstandingField] = Math.max(
      0,
      partySummary[outstandingField] - returnAmount,
    );
    partySummaryByParty.set(party, partySummary);
  }

  summary[totalReturnField] = [...returnsByParty.values()].reduce(
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
  const entries = await outstandingQueries.findBillEntries(
    reportContext,
    [...options.transactionCodes, ...options.returnCodes],
    financialYear,
  );
  const billNumbers = [
    ...new Set(
      entries
        .filter(
          (entry) =>
            !options.returnCodes.includes(entry.code) && entry.bill_no,
        )
        .map((entry) => entry.bill_no),
    ),
  ];
  const allocations =
    billNumbers.length === 0
      ? []
      : await outstandingQueries.findPaymentAllocations(
          reportContext,
          options.paymentCode,
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
