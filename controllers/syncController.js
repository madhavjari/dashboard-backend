const {
  upsertAccountingCompanies,
} = require("../db/accountingCompanyQueries");
const {
  ingestBills,
  ingestPaymentVouchers,
} = require("../db/syncIngestionQueries");

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

async function postBillData(req, res) {
  const data = req.body;
  return res.status(200).json({
    success: true,
    message: `Received ${data.length || 0} rows successfully!`,
  });
}

module.exports = {
  postAccountingCompanies,
  postBills,
  postPaymentVouchers,
  postBillData,
};
