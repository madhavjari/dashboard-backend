const { neonprisma } = require("../lib/neon.js");

const SALES_CODE = "S";
const SALES_RETURN_CODE = "SR";
const BANK_RECEIPT_CODE = "BR";
const PURCHASE_CODES = ["P", "OP", "FJ"];
const PURCHASE_RETURN_CODE = "PR";
const BANK_PAYMENT_CODE = "BP";

function toNumber(value) {
  return Number(value) || 0;
}

function createBillPartyKey(billNo, party) {
  return JSON.stringify([
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

function createOutstandingSale(entry) {
  return {
    billNo: entry.bill_no,
    billDate: entry.bill_date,
    party: entry.party,
    billAmount: toNumber(entry.net_amount),
    adjustedAmount: 0,
    unadjustedAmount: 0,
    allocationBalance: 0,
    amountToCollect: toNumber(entry.net_amount),
    overpaidAmount: 0,
    totalPaymentDays: 0,
    paymentCount: 0,
    averagePaymentDays: null,
    payments: [],
  };
}

function addBankReceiptAllocation(sale, allocation) {
  const adjustedAmount = toNumber(allocation.adjust_amt);
  const amountToCollect =
    sale.billAmount - (sale.adjustedAmount + adjustedAmount);

  sale.adjustedAmount += adjustedAmount;
  sale.unadjustedAmount += toNumber(allocation.unadj_amt);
  sale.allocationBalance += toNumber(allocation.bal_amt);
  sale.amountToCollect = Math.max(0, amountToCollect);
  sale.overpaidAmount = Math.max(0, -amountToCollect);
  addPaymentTiming(sale, allocation.payment_vouchers);
  sale.payments.push({
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

async function getSales() {
  const salesEntries = await neonprisma.sales_entries.findMany({
    where: {
      code: { in: [SALES_CODE, SALES_RETURN_CODE] },
    },
    select: {
      code: true,
      bill_no: true,
      bill_date: true,
      party: true,
      net_amount: true,
    },
    orderBy: { bill_date: "desc" },
  });

  const salesByBillAndParty = new Map();
  const returnsByParty = new Map();
  for (const entry of salesEntries) {
    if (entry.code === SALES_RETURN_CODE) {
      returnsByParty.set(
        entry.party,
        (returnsByParty.get(entry.party) || 0) + toNumber(entry.net_amount),
      );
      continue;
    }

    if (!entry.bill_no) continue;

    const saleKey = createBillPartyKey(entry.bill_no, entry.party);
    const sale = salesByBillAndParty.get(saleKey);
    if (sale) {
      sale.billAmount += toNumber(entry.net_amount);
      sale.amountToCollect = sale.billAmount - sale.adjustedAmount;
      continue;
    }
    salesByBillAndParty.set(saleKey, createOutstandingSale(entry));
  }

  const billNumbers = [
    ...new Set([...salesByBillAndParty.values()].map((sale) => sale.billNo)),
  ];
  if (billNumbers.length > 0) {
    const allocations = await neonprisma.bill_payment_allocations.findMany({
      where: {
        code: BANK_RECEIPT_CODE,
        bill_no: { in: billNumbers },
      },
      select: {
        bill_no: true,
        adjust_amt: true,
        unadj_amt: true,
        bal_amt: true,
        payment_vouchers: {
          select: {
            mode: true,
            party: true,
            cheque_date: true,
            clearing_date: true,
            net_amount: true,
          },
        },
      },
    });

    for (const allocation of allocations) {
      const sale = salesByBillAndParty.get(
        createBillPartyKey(
          allocation.bill_no,
          allocation.payment_vouchers.party,
        ),
      );
      if (sale) addBankReceiptAllocation(sale, allocation);
    }
  }

  const data = [...salesByBillAndParty.values()];
  const partySummaryByParty = new Map();

  for (const sale of data) {
    const partySummary = partySummaryByParty.get(sale.party) || {
      party: sale.party,
      totalSalesAmount: 0,
      totalAdjustedAmount: 0,
      totalSalesReturnAmount: 0,
      amountToCollect: 0,
    };
    partySummary.totalSalesAmount += sale.billAmount;
    partySummary.totalAdjustedAmount += sale.adjustedAmount;
    partySummary.amountToCollect += sale.amountToCollect;
    partySummaryByParty.set(sale.party, partySummary);
  }

  for (const [party, returnAmount] of returnsByParty) {
    const partySummary = partySummaryByParty.get(party) || {
      party,
      totalSalesAmount: 0,
      totalAdjustedAmount: 0,
      totalSalesReturnAmount: 0,
      amountToCollect: 0,
    };
    partySummary.totalSalesReturnAmount += returnAmount;
    partySummary.amountToCollect = Math.max(
      0,
      partySummary.amountToCollect - returnAmount,
    );
    partySummaryByParty.set(party, partySummary);
  }

  const partySummary = [...partySummaryByParty.values()].sort(
    (first, second) => second.amountToCollect - first.amountToCollect,
  );
  const summary = data.reduce(
    (totals, sale) => {
      totals.totalSalesAmount += sale.billAmount;
      totals.totalAdjustedAmount += sale.adjustedAmount;
      totals.totalToCollect += sale.amountToCollect;
      totals.totalOverpaidAmount += sale.overpaidAmount;
      totals.invoiceCount += 1;
      if (sale.amountToCollect === 0) totals.paidInvoiceCount += 1;
      else totals.outstandingInvoiceCount += 1;
      return totals;
    },
    {
      totalSalesAmount: 0,
      totalAdjustedAmount: 0,
      totalSalesReturnAmount: 0,
      totalToCollect: 0,
      totalOverpaidAmount: 0,
      invoiceCount: 0,
      paidInvoiceCount: 0,
      outstandingInvoiceCount: 0,
    },
  );

  summary.totalSalesReturnAmount = [...returnsByParty.values()].reduce(
    (total, amount) => total + amount,
    0,
  );
  summary.totalToCollect = partySummary.reduce(
    (total, party) => total + party.amountToCollect,
    0,
  );

  return { summary, data, partySummary };
}

async function getPurchases() {
  const purchaseEntries = await neonprisma.sales_entries.findMany({
    where: {
      code: { in: [...PURCHASE_CODES, PURCHASE_RETURN_CODE] },
    },
    select: {
      code: true,
      bill_no: true,
      bill_date: true,
      party: true,
      net_amount: true,
    },
    orderBy: { bill_date: "desc" },
  });

  const purchasesByBillAndParty = new Map();
  const returnsByParty = new Map();
  for (const entry of purchaseEntries) {
    if (entry.code === PURCHASE_RETURN_CODE) {
      returnsByParty.set(
        entry.party,
        (returnsByParty.get(entry.party) || 0) + toNumber(entry.net_amount),
      );
      continue;
    }

    if (!entry.bill_no) continue;

    const purchaseKey = createBillPartyKey(entry.bill_no, entry.party);
    const purchase = purchasesByBillAndParty.get(purchaseKey);
    if (purchase) {
      purchase.billAmount += toNumber(entry.net_amount);
      purchase.amountToPay = purchase.billAmount - purchase.adjustedAmount;
      continue;
    }

    purchasesByBillAndParty.set(purchaseKey, {
      billNo: entry.bill_no,
      billDate: entry.bill_date,
      party: entry.party,
      billAmount: toNumber(entry.net_amount),
      adjustedAmount: 0,
      unadjustedAmount: 0,
      allocationBalance: 0,
      amountToPay: toNumber(entry.net_amount),
      overpaidAmount: 0,
      totalPaymentDays: 0,
      paymentCount: 0,
      averagePaymentDays: null,
      payments: [],
    });
  }

  const billNumbers = [
    ...new Set(
      [...purchasesByBillAndParty.values()].map((purchase) => purchase.billNo),
    ),
  ];
  if (billNumbers.length > 0) {
    const allocations = await neonprisma.bill_payment_allocations.findMany({
      where: {
        code: BANK_PAYMENT_CODE,
        bill_no: { in: billNumbers },
      },
      select: {
        bill_no: true,
        adjust_amt: true,
        unadj_amt: true,
        bal_amt: true,
        payment_vouchers: {
          select: {
            mode: true,
            party: true,
            cheque_date: true,
            clearing_date: true,
            net_amount: true,
          },
        },
      },
    });

    for (const allocation of allocations) {
      const purchase = purchasesByBillAndParty.get(
        createBillPartyKey(
          allocation.bill_no,
          allocation.payment_vouchers.party,
        ),
      );
      if (!purchase) continue;

      const adjustedAmount = toNumber(allocation.adjust_amt);
      const amountToPay =
        purchase.billAmount - (purchase.adjustedAmount + adjustedAmount);

      purchase.adjustedAmount += adjustedAmount;
      purchase.unadjustedAmount += toNumber(allocation.unadj_amt);
      purchase.allocationBalance += toNumber(allocation.bal_amt);
      purchase.amountToPay = Math.max(0, amountToPay);
      purchase.overpaidAmount = Math.max(0, -amountToPay);
      addPaymentTiming(purchase, allocation.payment_vouchers);
      purchase.payments.push({
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
  }

  const data = [...purchasesByBillAndParty.values()];
  const partySummaryByParty = new Map();
  const summary = data.reduce(
    (totals, purchase) => {
      totals.totalPurchaseAmount += purchase.billAmount;
      totals.totalAdjustedAmount += purchase.adjustedAmount;
      totals.totalToPay += purchase.amountToPay;
      totals.totalOverpaidAmount += purchase.overpaidAmount;
      totals.invoiceCount += 1;
      if (purchase.amountToPay === 0) totals.paidInvoiceCount += 1;
      else totals.outstandingInvoiceCount += 1;

      const partySummary = partySummaryByParty.get(purchase.party) || {
        party: purchase.party,
        totalPurchaseAmount: 0,
        totalAdjustedAmount: 0,
        totalPurchaseReturnAmount: 0,
        amountToPay: 0,
      };
      partySummary.totalPurchaseAmount += purchase.billAmount;
      partySummary.totalAdjustedAmount += purchase.adjustedAmount;
      partySummary.amountToPay += purchase.amountToPay;
      partySummaryByParty.set(purchase.party, partySummary);

      return totals;
    },
    {
      totalPurchaseAmount: 0,
      totalAdjustedAmount: 0,
      totalPurchaseReturnAmount: 0,
      totalToPay: 0,
      totalOverpaidAmount: 0,
      invoiceCount: 0,
      paidInvoiceCount: 0,
      outstandingInvoiceCount: 0,
    },
  );

  for (const [party, returnAmount] of returnsByParty) {
    const partySummary = partySummaryByParty.get(party) || {
      party,
      totalPurchaseAmount: 0,
      totalAdjustedAmount: 0,
      totalPurchaseReturnAmount: 0,
      amountToPay: 0,
    };
    partySummary.totalPurchaseReturnAmount += returnAmount;
    partySummary.amountToPay = Math.max(
      0,
      partySummary.amountToPay - returnAmount,
    );
    partySummaryByParty.set(party, partySummary);
  }

  summary.totalPurchaseReturnAmount = [...returnsByParty.values()].reduce(
    (total, amount) => total + amount,
    0,
  );
  summary.totalToPay = [...partySummaryByParty.values()].reduce(
    (total, party) => total + party.amountToPay,
    0,
  );

  const partySummary = [...partySummaryByParty.values()].sort(
    (first, second) => second.amountToPay - first.amountToPay,
  );

  return { summary, data, partySummary };
}

module.exports = { getSales, getPurchases };
