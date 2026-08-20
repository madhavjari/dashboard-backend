-- The normalized tenant-aware accounting models are now the only runtime
-- source. Their imported rows are preserved; only obsolete tables are removed.
DROP TABLE IF EXISTS "bill_data";
DROP TABLE IF EXISTS "bill_payment_allocations";
DROP TABLE IF EXISTS "bill_entries";
DROP TABLE IF EXISTS "payment_vouchers";

-- Computer sync authentication uses SyncApiKey. The old user-level API-key
-- table is no longer modeled or referenced by the application.
DROP TABLE IF EXISTS "Apikey";
