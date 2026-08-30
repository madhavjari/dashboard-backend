CREATE TABLE "BillReturnAdjustment" (
    "id" BIGSERIAL NOT NULL,
    "companyId" TEXT NOT NULL,
    "billEntryId" BIGINT NOT NULL,
    "sourceEntryId" VARCHAR(100) NOT NULL,
    "returnBillEntryId" VARCHAR(100) NOT NULL,
    "adjustedAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillReturnAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillReturnAdjustment_companyId_billEntryId_sourceEntryId_key"
ON "BillReturnAdjustment"("companyId", "billEntryId", "sourceEntryId");

CREATE INDEX "BillReturnAdjustment_companyId_billEntryId_idx"
ON "BillReturnAdjustment"("companyId", "billEntryId");

CREATE INDEX "BillReturnAdjustment_companyId_returnBillEntryId_idx"
ON "BillReturnAdjustment"("companyId", "returnBillEntryId");

ALTER TABLE "BillReturnAdjustment"
ADD CONSTRAINT "BillReturnAdjustment_companyId_billEntryId_fkey"
FOREIGN KEY ("companyId", "billEntryId") REFERENCES "BillEntry"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
