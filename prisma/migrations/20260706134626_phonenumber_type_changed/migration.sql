-- AlterTable
ALTER TABLE "Apikey" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + interval '1 year';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "phoneNumber" SET DATA TYPE TEXT;
