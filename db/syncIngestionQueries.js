const { prisma } = require("../lib/prisma");
const { getCurrentFinancialYear } = require("../utils/financialYear");

const nullable = (value) => value ?? null;
const decimalOrZero = (value) => value ?? 0;
const DEFAULT_FINANCIAL_YEAR = getCurrentFinancialYear();

async function resolveAccountingCompanies(
  tx,
  { companyId, syncSourceId, records },
) {
  const externalCompanyIds = [
    ...new Set(records.map((record) => record.compNo)),
  ];
  const accountingCompanies = await tx.accountingCompany.findMany({
    where: {
      companyId,
      syncSourceId,
      externalId: { in: externalCompanyIds },
    },
    select: {
      id: true,
      externalId: true,
    },
  });

  const companyByExternalId = new Map(
    accountingCompanies.map((company) => [company.externalId, company]),
  );
  const unknownExternalCompanyIds = externalCompanyIds.filter(
    (externalId) => !companyByExternalId.has(externalId),
  );

  return { companyByExternalId, unknownExternalCompanyIds };
}

function mapBillData(bill, accountingCompanyId) {
  return {
    accountingCompanyId,
    financialYear: bill.financialYear ?? DEFAULT_FINANCIAL_YEAR,
    isOpening: bill.isOpening === true,
    entryId: bill.entryId,
    compNo: bill.compNo,
    code: nullable(bill.code),
    book: nullable(bill.book),
    billNo: nullable(bill.billNo),
    billDate: nullable(bill.date),
    party: nullable(bill.party),
    partyCode: nullable(bill.partyCode),
    agent: nullable(bill.agent),
    grossAmount: nullable(bill.grossAmount),
    netAmount: nullable(bill.netAmount),
    cgst: decimalOrZero(bill.cgst),
    sgst: decimalOrZero(bill.sgst),
    igst: decimalOrZero(bill.igst),
    sourceCreatedAt: nullable(bill.entryDate),
    sourceModifiedAt: nullable(bill.modifyDate),
    sourceModifyTime: nullable(bill.modifyTime),
  };
}

function mapBillItem(item, { companyId, billEntryId }) {
  return {
    companyId,
    billEntryId,
    entryId: nullable(item.entryId),
    serial: nullable(item.serial),
    itemCode: nullable(item.itemCode),
    itemName: nullable(item.itemName),
    category: nullable(item.category),
    itemGroup: nullable(item.group),
    brand: nullable(item.brand),
    quality: nullable(item.quality),
    design: nullable(item.design),
    colour: nullable(item.colour),
    pattern: nullable(item.pattern),
    pcs: decimalOrZero(item.pcs),
    meters: decimalOrZero(item.meters),
    quantity: decimalOrZero(item.quantity),
    weight: decimalOrZero(item.weight),
    per: nullable(item.per),
    discountPercent: nullable(item.discountPercent),
    discountAmount: nullable(item.discount),
    rate: decimalOrZero(item.rate),
    amount: decimalOrZero(item.amount),
    taxableAmount: decimalOrZero(item.taxable),
    finalAmount: decimalOrZero(item.finalAmount),
    cgstRate: nullable(item.cgstRate),
    cgstAmount: nullable(item.cgstAmount),
    sgstRate: nullable(item.sgstRate),
    sgstAmount: nullable(item.sgstAmount),
    igstRate: nullable(item.igstRate),
    igstAmount: nullable(item.igstAmount),
    cessRate: nullable(item.cessRate),
    cessAmount: nullable(item.cessAmount),
    remarks: nullable(item.remarks),
  };
}

function mapBillReturnAdjustment(adjustment, { companyId, billEntryId }) {
  return {
    companyId,
    billEntryId,
    sourceEntryId: adjustment.entryId,
    returnBillEntryId: adjustment.returnEntryId,
    adjustedAmount: decimalOrZero(adjustment.adjustedAmount),
  };
}

function mapVoucherData(voucher, accountingCompanyId) {
  return {
    accountingCompanyId,
    financialYear: voucher.financialYear ?? DEFAULT_FINANCIAL_YEAR,
    isOpening: voucher.isOpening === true,
    entryId: voucher.entryId,
    compNo: voucher.compNo,
    voucherDate: nullable(voucher.date),
    mode: nullable(voucher.mode),
    voucherType: nullable(voucher.vchrType),
    slipNo: nullable(voucher.slipNo),
    referenceNo: nullable(voucher.refNo),
    party: nullable(voucher.party),
    chequeNo: nullable(voucher.chequeNo),
    chequeDate: nullable(voucher.chequeDate),
    chequeBank: nullable(voucher.chequeBank),
    clearingDate: nullable(voucher.clearingDate),
    netAmount: nullable(voucher.netAmount),
    remarks: nullable(voucher.remarks),
    sourceModifiedAt: nullable(voucher.modifyDate),
    sourceModifyTime: nullable(voucher.modifyTime),
  };
}

function mapPaymentAllocation(allocation, { companyId, paymentVoucherId }) {
  return {
    companyId,
    paymentVoucherId,
    entryId: nullable(allocation.entryId),
    code: nullable(allocation.code),
    billNo: nullable(allocation.billNo),
    billEntrySourceId: nullable(allocation.billEntrySourceId),
    allocationDate: nullable(allocation.date),
    mode: nullable(allocation.mode),
    billAmount: nullable(allocation.billAmt),
    adjustedAmount: nullable(allocation.adjustAmt),
    unadjustedAmount: nullable(allocation.unAdjAmt),
    balanceAmount: nullable(allocation.bAlAmt),
    status: nullable(allocation.status),
  };
}

async function ingestBills({ companyId, syncSourceId, bills }) {
  return prisma.$transaction(
    async (tx) => {
      const { companyByExternalId, unknownExternalCompanyIds } =
        await resolveAccountingCompanies(tx, {
          companyId,
          syncSourceId,
          records: bills,
        });

      if (unknownExternalCompanyIds.length > 0) {
        return {
          status: "unknown_companies",
          unknownExternalCompanyIds,
        };
      }

      for (const bill of bills) {
        const accountingCompany = companyByExternalId.get(bill.compNo);
        const billData = mapBillData(bill, accountingCompany.id);
        const storedBill = await tx.billEntry.upsert({
          where: {
            companyId_syncSourceId_financialYear_compNo_entryId: {
              companyId,
              syncSourceId,
              financialYear: billData.financialYear,
              compNo: bill.compNo,
              entryId: bill.entryId,
            },
          },
          create: {
            companyId,
            syncSourceId,
            ...billData,
          },
          update: billData,
          select: { id: true },
        });

        await tx.billItem.deleteMany({
          where: {
            companyId,
            billEntryId: storedBill.id,
          },
        });

        if (bill.items.length > 0) {
          await tx.billItem.createMany({
            data: bill.items.map((item) =>
              mapBillItem(item, {
                companyId,
                billEntryId: storedBill.id,
              }),
            ),
          });
        }

        await tx.billReturnAdjustment.deleteMany({
          where: {
            companyId,
            billEntryId: storedBill.id,
          },
        });

        const returnAdjustments = bill.returnAdjustments ?? [];
        if (returnAdjustments.length > 0) {
          await tx.billReturnAdjustment.createMany({
            data: returnAdjustments.map((adjustment) =>
              mapBillReturnAdjustment(adjustment, {
                companyId,
                billEntryId: storedBill.id,
              }),
            ),
          });
        }
      }

      await tx.syncSource.update({
        where: {
          companyId_id: {
            companyId,
            id: syncSourceId,
          },
        },
        data: { lastSyncedAt: new Date() },
      });

      return {
        status: "ok",
        count: bills.length,
        accountingCompanyCount: companyByExternalId.size,
      };
    },
    { timeout: 30_000 },
  );
}

async function ingestPaymentVouchers({ companyId, syncSourceId, vouchers }) {
  return prisma.$transaction(
    async (tx) => {
      const { companyByExternalId, unknownExternalCompanyIds } =
        await resolveAccountingCompanies(tx, {
          companyId,
          syncSourceId,
          records: vouchers,
        });

      if (unknownExternalCompanyIds.length > 0) {
        return {
          status: "unknown_companies",
          unknownExternalCompanyIds,
        };
      }

      for (const voucher of vouchers) {
        const accountingCompany = companyByExternalId.get(voucher.compNo);
        const voucherData = mapVoucherData(voucher, accountingCompany.id);
        const storedVoucher = await tx.paymentVoucher.upsert({
          where: {
            companyId_syncSourceId_financialYear_compNo_entryId: {
              companyId,
              syncSourceId,
              financialYear: voucherData.financialYear,
              compNo: voucher.compNo,
              entryId: voucher.entryId,
            },
          },
          create: {
            companyId,
            syncSourceId,
            ...voucherData,
          },
          update: voucherData,
          select: { id: true },
        });

        await tx.paymentAllocation.deleteMany({
          where: {
            companyId,
            paymentVoucherId: storedVoucher.id,
          },
        });

        if (voucher.items.length > 0) {
          await tx.paymentAllocation.createMany({
            data: voucher.items.map((allocation) =>
              mapPaymentAllocation(allocation, {
                companyId,
                paymentVoucherId: storedVoucher.id,
              }),
            ),
          });
        }
      }

      await tx.syncSource.update({
        where: {
          companyId_id: {
            companyId,
            id: syncSourceId,
          },
        },
        data: { lastSyncedAt: new Date() },
      });

      return {
        status: "ok",
        count: vouchers.length,
        accountingCompanyCount: companyByExternalId.size,
      };
    },
    { timeout: 30_000 },
  );
}

module.exports = {
  ingestBills,
  ingestPaymentVouchers,
};
