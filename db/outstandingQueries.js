const { neonprisma } = require("../lib/neon.js");

async function findBillEntries(codes) {
  return neonprisma.bill_entries.findMany({
    where: {
      code: { in: codes },
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
}

async function findPaymentAllocations(code, billNumbers) {
  return neonprisma.bill_payment_allocations.findMany({
    where: {
      code,
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
}

module.exports = { findBillEntries, findPaymentAllocations };
