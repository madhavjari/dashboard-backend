/*
  Warnings:

  - A unique constraint covering the columns `[apikey]` on the table `Apikey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `apikey` to the `Apikey` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Apikey" ADD COLUMN     "apikey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Apikey_apikey_key" ON "Apikey"("apikey");
