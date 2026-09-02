-- Nullable for a safe production rollout; existing allocations will be
-- backfilled from ACCVCHRDET.BillId in a later sync deployment.
ALTER TABLE "PaymentAllocation"
ADD COLUMN "billEntrySourceId" VARCHAR(100);

CREATE INDEX "PaymentAllocation_companyId_billEntrySourceId_idx"
ON "PaymentAllocation"("companyId", "billEntrySourceId");
