-- Existing synchronized rows came from the 2025-2026 source database. A
-- subsequent sync refreshes their opening flags from MSSQL.
ALTER TABLE "BillEntry"
ADD COLUMN "financialYear" VARCHAR(9) NOT NULL DEFAULT '2025-2026',
ADD COLUMN "isOpening" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PaymentVoucher"
ADD COLUMN "financialYear" VARCHAR(9) NOT NULL DEFAULT '2025-2026',
ADD COLUMN "isOpening" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX "BillEntry_companyId_syncSourceId_compNo_entryId_key";
DROP INDEX "PaymentVoucher_companyId_syncSourceId_compNo_entryId_key";

CREATE UNIQUE INDEX "BillEntry_sync_financial_year_key"
ON "BillEntry"("companyId", "syncSourceId", "financialYear", "compNo", "entryId");

CREATE UNIQUE INDEX "PaymentVoucher_sync_financial_year_key"
ON "PaymentVoucher"("companyId", "syncSourceId", "financialYear", "compNo", "entryId");

CREATE INDEX "BillEntry_companyId_financialYear_isOpening_idx"
ON "BillEntry"("companyId", "financialYear", "isOpening");

CREATE INDEX "PaymentVoucher_companyId_financialYear_isOpening_idx"
ON "PaymentVoucher"("companyId", "financialYear", "isOpening");
