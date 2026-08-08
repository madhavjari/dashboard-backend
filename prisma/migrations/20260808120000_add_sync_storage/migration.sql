-- Add timestamps used for company and membership auditing.
ALTER TABLE "Company"
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CompanyUser"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "CompanyUser_userId_idx" ON "CompanyUser"("userId");

-- A sync source represents one accounting database/installation owned by a
-- company. All synchronized records and credentials are scoped through it.
CREATE TABLE "SyncSource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "SyncSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncSource_companyId_idx" ON "SyncSource"("companyId");
CREATE UNIQUE INDEX "SyncSource_companyId_id_key" ON "SyncSource"("companyId", "id");

CREATE TABLE "SyncApiKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "syncSourceId" TEXT NOT NULL,
    "name" TEXT,
    "keyPrefix" VARCHAR(32) NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT NOW() + interval '1 year',
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SyncApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncApiKey_keyPrefix_key" ON "SyncApiKey"("keyPrefix");
CREATE UNIQUE INDEX "SyncApiKey_keyHash_key" ON "SyncApiKey"("keyHash");
CREATE INDEX "SyncApiKey_companyId_syncSourceId_idx" ON "SyncApiKey"("companyId", "syncSourceId");

CREATE TABLE "BillEntry" (
    "id" BIGSERIAL NOT NULL,
    "companyId" TEXT NOT NULL,
    "syncSourceId" TEXT NOT NULL,
    "entryId" VARCHAR(100) NOT NULL,
    "compNo" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50),
    "book" VARCHAR(100),
    "billNo" VARCHAR(100),
    "billDate" DATE,
    "party" VARCHAR(255),
    "partyCode" VARCHAR(100),
    "agent" VARCHAR(255),
    "grossAmount" DECIMAL(18,2),
    "netAmount" DECIMAL(18,2),
    "cgst" DECIMAL(18,2) DEFAULT 0,
    "sgst" DECIMAL(18,2) DEFAULT 0,
    "igst" DECIMAL(18,2) DEFAULT 0,
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceModifiedAt" TIMESTAMP(3),
    "sourceModifyTime" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillEntry_companyId_billDate_idx" ON "BillEntry"("companyId", "billDate");
CREATE INDEX "BillEntry_companyId_code_billDate_idx" ON "BillEntry"("companyId", "code", "billDate");
CREATE INDEX "BillEntry_companyId_party_idx" ON "BillEntry"("companyId", "party");
CREATE UNIQUE INDEX "BillEntry_companyId_id_key" ON "BillEntry"("companyId", "id");
CREATE UNIQUE INDEX "BillEntry_companyId_syncSourceId_compNo_entryId_key" ON "BillEntry"("companyId", "syncSourceId", "compNo", "entryId");

CREATE TABLE "BillItem" (
    "id" BIGSERIAL NOT NULL,
    "companyId" TEXT NOT NULL,
    "billEntryId" BIGINT NOT NULL,
    "entryId" VARCHAR(100),
    "serial" VARCHAR(50),
    "itemCode" VARCHAR(100),
    "itemName" VARCHAR(255),
    "category" VARCHAR(255),
    "itemGroup" VARCHAR(255),
    "brand" VARCHAR(255),
    "quality" VARCHAR(255),
    "design" VARCHAR(255),
    "colour" VARCHAR(255),
    "pattern" VARCHAR(255),
    "pcs" DECIMAL(18,3) DEFAULT 0,
    "meters" DECIMAL(18,3) DEFAULT 0,
    "quantity" DECIMAL(18,3) DEFAULT 0,
    "weight" DECIMAL(18,3) DEFAULT 0,
    "per" VARCHAR(100),
    "discountPercent" DECIMAL(9,4),
    "discountAmount" DECIMAL(18,2),
    "rate" DECIMAL(18,2) DEFAULT 0,
    "amount" DECIMAL(18,2) DEFAULT 0,
    "taxableAmount" DECIMAL(18,2) DEFAULT 0,
    "finalAmount" DECIMAL(18,2) DEFAULT 0,
    "cgstRate" DECIMAL(9,4),
    "cgstAmount" DECIMAL(18,2),
    "sgstRate" DECIMAL(9,4),
    "sgstAmount" DECIMAL(18,2),
    "igstRate" DECIMAL(9,4),
    "igstAmount" DECIMAL(18,2),
    "cessRate" DECIMAL(9,4),
    "cessAmount" DECIMAL(18,2),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillItem_companyId_billEntryId_idx" ON "BillItem"("companyId", "billEntryId");
CREATE INDEX "BillItem_companyId_itemName_idx" ON "BillItem"("companyId", "itemName");
CREATE UNIQUE INDEX "BillItem_companyId_billEntryId_entryId_key" ON "BillItem"("companyId", "billEntryId", "entryId");

CREATE TABLE "PaymentVoucher" (
    "id" BIGSERIAL NOT NULL,
    "companyId" TEXT NOT NULL,
    "syncSourceId" TEXT NOT NULL,
    "entryId" VARCHAR(100) NOT NULL,
    "compNo" VARCHAR(100) NOT NULL,
    "voucherDate" DATE,
    "mode" VARCHAR(100),
    "voucherType" VARCHAR(100),
    "slipNo" VARCHAR(100),
    "referenceNo" VARCHAR(100),
    "party" VARCHAR(255),
    "chequeNo" VARCHAR(100),
    "chequeDate" DATE,
    "chequeBank" VARCHAR(255),
    "clearingDate" DATE,
    "netAmount" DECIMAL(18,2),
    "remarks" TEXT,
    "sourceModifiedAt" TIMESTAMP(3),
    "sourceModifyTime" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentVoucher_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentVoucher_companyId_voucherDate_idx" ON "PaymentVoucher"("companyId", "voucherDate");
CREATE INDEX "PaymentVoucher_companyId_party_idx" ON "PaymentVoucher"("companyId", "party");
CREATE UNIQUE INDEX "PaymentVoucher_companyId_id_key" ON "PaymentVoucher"("companyId", "id");
CREATE UNIQUE INDEX "PaymentVoucher_companyId_syncSourceId_compNo_entryId_key" ON "PaymentVoucher"("companyId", "syncSourceId", "compNo", "entryId");

CREATE TABLE "PaymentAllocation" (
    "id" BIGSERIAL NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentVoucherId" BIGINT NOT NULL,
    "entryId" VARCHAR(100),
    "code" VARCHAR(100),
    "billNo" VARCHAR(100),
    "allocationDate" DATE,
    "mode" VARCHAR(100),
    "billAmount" DECIMAL(18,2),
    "adjustedAmount" DECIMAL(18,2),
    "unadjustedAmount" DECIMAL(18,2),
    "balanceAmount" DECIMAL(18,2),
    "status" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentAllocation_companyId_paymentVoucherId_idx" ON "PaymentAllocation"("companyId", "paymentVoucherId");
CREATE INDEX "PaymentAllocation_companyId_billNo_idx" ON "PaymentAllocation"("companyId", "billNo");
CREATE UNIQUE INDEX "PaymentAllocation_companyId_paymentVoucherId_entryId_key" ON "PaymentAllocation"("companyId", "paymentVoucherId", "entryId");

ALTER TABLE "SyncSource"
ADD CONSTRAINT "SyncSource_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncApiKey"
ADD CONSTRAINT "SyncApiKey_companyId_syncSourceId_fkey"
FOREIGN KEY ("companyId", "syncSourceId") REFERENCES "SyncSource"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillEntry"
ADD CONSTRAINT "BillEntry_companyId_syncSourceId_fkey"
FOREIGN KEY ("companyId", "syncSourceId") REFERENCES "SyncSource"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillItem"
ADD CONSTRAINT "BillItem_companyId_billEntryId_fkey"
FOREIGN KEY ("companyId", "billEntryId") REFERENCES "BillEntry"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentVoucher"
ADD CONSTRAINT "PaymentVoucher_companyId_syncSourceId_fkey"
FOREIGN KEY ("companyId", "syncSourceId") REFERENCES "SyncSource"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentAllocation"
ADD CONSTRAINT "PaymentAllocation_companyId_paymentVoucherId_fkey"
FOREIGN KEY ("companyId", "paymentVoucherId") REFERENCES "PaymentVoucher"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
