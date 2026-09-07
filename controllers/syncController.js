const { upsertAccountingCompanies } = require("../db/accountingCompanyQueries");
const {
  deleteBills: deleteBillRecords,
  deletePaymentVouchers: deletePaymentVoucherRecords,
  ingestBills,
  ingestPaymentVouchers,
} = require("../db/syncIngestionQueries");

function createDeleteHandler(deleteRecords, label) {
  return async function deleteSynchronizedRecords(req, res) {
    try {
      const result = await deleteRecords({
        companyId: req.syncAuth.companyId,
        syncSourceId: req.syncAuth.syncSourceId,
        records: req.body,
      });
      return res.status(200).json({
        success: true,
        message: `Deleted ${result.count} ${label}(s).`,
        count: result.count,
      });
    } catch (error) {
      console.error(`Failed to delete synchronized ${label}s:`, error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };
}

const deleteBills = createDeleteHandler(deleteBillRecords, "bill");
const deletePaymentVouchers = createDeleteHandler(
  deletePaymentVoucherRecords,
  "voucher",
);

async function postAccountingCompanies(req, res) {
  try {
    const accountingCompanies = await upsertAccountingCompanies({
      companyId: req.syncAuth.companyId,
      syncSourceId: req.syncAuth.syncSourceId,
      companies: req.body.companies,
    });

    return res.status(200).json({
      message: "Accounting companies synchronized successfully.",
      count: accountingCompanies.length,
      data: accountingCompanies,
    });
  } catch (error) {
    console.error("Failed to synchronize accounting companies:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

function unknownAccountingCompanyResponse(res, result) {
  return res.status(422).json({
    code: "ACCOUNTING_COMPANY_NOT_REGISTERED",
    message: "Register accounting companies before uploading records.",
    unknownExternalCompanyIds: result.unknownExternalCompanyIds,
  });
}

async function postBills(req, res) {
  try {
    const result = await ingestBills({
      companyId: req.syncAuth.companyId,
      syncSourceId: req.syncAuth.syncSourceId,
      bills: req.body,
    });

    if (result.status === "unknown_companies") {
      return unknownAccountingCompanyResponse(res, result);
    }

    return res.status(200).json({
      success: true,
      message: `Synchronized ${result.count} bill(s).`,
      count: result.count,
      accountingCompanyCount: result.accountingCompanyCount,
    });
  } catch (error) {
    console.error("Failed to synchronize bills:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function postPaymentVouchers(req, res) {
  try {
    const result = await ingestPaymentVouchers({
      companyId: req.syncAuth.companyId,
      syncSourceId: req.syncAuth.syncSourceId,
      vouchers: req.body,
    });

    if (result.status === "unknown_companies") {
      return unknownAccountingCompanyResponse(res, result);
    }

    return res.status(200).json({
      success: true,
      message: `Synchronized ${result.count} voucher(s).`,
      count: result.count,
      accountingCompanyCount: result.accountingCompanyCount,
    });
  } catch (error) {
    console.error("Failed to synchronize payment vouchers:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  deleteBills,
  deletePaymentVouchers,
  postAccountingCompanies,
  postBills,
  postPaymentVouchers,
};
