-- AlterTable
ALTER TABLE "SyncApiKey" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + interval '1 year';
