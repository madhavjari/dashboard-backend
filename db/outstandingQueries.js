const { prisma } = require("../lib/prisma.js");
const {
  createAccountingCompanyWhere,
  createCompanyWhere,
} = require("./reportScope");

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
      code: true,
      billNo: true,
      billDate: true,
      party: true,
      netAmount: true,
      items: {
        select: {
          itemName: true,
        },
      },
    },
    orderBy: { billDate: "desc" },
  });

  return rows.map((row) => ({
    accounting_company_id: row.accountingCompanyId,
    code: row.code,
    bill_no: row.billNo,
    bill_date: row.billDate,
    party: row.party,
    net_amount: row.netAmount,
    item_names: [
      ...new Set(row.items.map((item) => item.itemName).filter(Boolean)),
    ],
  }));
}

async function findPaymentAllocations(
  reportContext,
  code,
  billNumbers,
  financialYear,
) {
  const rows = await prisma.paymentAllocation.findMany({
    where: {
      ...createCompanyWhere(reportContext),
      code,
      billNo: { in: billNumbers },
      paymentVoucher: {
        financialYear,
        ...createAccountingCompanyWhere(reportContext),
      },
    },
    select: {
      billNo: true,
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
