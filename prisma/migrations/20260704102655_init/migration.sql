-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "apikeyId" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apikey" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "Apikey_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_apikeyId_fkey" FOREIGN KEY ("apikeyId") REFERENCES "Apikey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
