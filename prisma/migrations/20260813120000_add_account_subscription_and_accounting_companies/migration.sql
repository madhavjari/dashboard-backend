-- The existing Company row is the customer account/workspace. Subscription
-- access applies to every user and accounting company under that account.
CREATE TYPE "SubscriptionStatus" AS ENUM (
    'PENDING',
    'TRIAL',
    'ACTIVE',
    'EXPIRED',
    'SUSPENDED'
);

ALTER TABLE "Company"
ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "trialStartedAt" TIMESTAMP(3),
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "subscriptionStartedAt" TIMESTAMP(3),
ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);

-- One sync source represents one computer. It can discover and synchronize
-- many accounting companies while continuing to use one API key.
CREATE TABLE "AccountingCompany" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "syncSourceId" TEXT NOT NULL,
    "externalId" VARCHAR(200) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingCompany_companyId_id_key"
ON "AccountingCompany"("companyId", "id");

CREATE UNIQUE INDEX "AccountingCompany_companyId_syncSourceId_externalId_key"
ON "AccountingCompany"("companyId", "syncSourceId", "externalId");

CREATE INDEX "AccountingCompany_companyId_name_idx"
ON "AccountingCompany"("companyId", "name");

CREATE INDEX "AccountingCompany_syncSourceId_idx"
ON "AccountingCompany"("syncSourceId");

ALTER TABLE "AccountingCompany"
ADD CONSTRAINT "AccountingCompany_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountingCompany"
ADD CONSTRAINT "AccountingCompany_companyId_syncSourceId_fkey"
FOREIGN KEY ("companyId", "syncSourceId")
REFERENCES "SyncSource"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- These are nullable during the transition so existing synchronized rows can
-- be mapped before the columns become required in a later migration.
ALTER TABLE "BillEntry"
ADD COLUMN "accountingCompanyId" TEXT;

ALTER TABLE "PaymentVoucher"
ADD COLUMN "accountingCompanyId" TEXT;

CREATE INDEX "BillEntry_companyId_accountingCompanyId_billDate_idx"
ON "BillEntry"("companyId", "accountingCompanyId", "billDate");

CREATE INDEX "PaymentVoucher_companyId_accountingCompanyId_voucherDate_idx"
ON "PaymentVoucher"("companyId", "accountingCompanyId", "voucherDate");

ALTER TABLE "BillEntry"
ADD CONSTRAINT "BillEntry_companyId_accountingCompanyId_fkey"
FOREIGN KEY ("companyId", "accountingCompanyId")
REFERENCES "AccountingCompany"("companyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentVoucher"
ADD CONSTRAINT "PaymentVoucher_companyId_accountingCompanyId_fkey"
FOREIGN KEY ("companyId", "accountingCompanyId")
REFERENCES "AccountingCompany"("companyId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

