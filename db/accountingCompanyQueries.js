const { prisma } = require("../lib/prisma");

async function upsertAccountingCompanies({
  companyId,
  syncSourceId,
  companies,
}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const storedCompanies = [];

    for (const company of companies) {
      const storedCompany = await tx.accountingCompany.upsert({
        where: {
          companyId_syncSourceId_externalId: {
            companyId,
            syncSourceId,
            externalId: company.externalCompanyId,
          },
        },
        create: {
          companyId,
          syncSourceId,
          externalId: company.externalCompanyId,
          name: company.name,
        },
        update: {
          name: company.name,
        },
        select: {
          id: true,
          externalId: true,
          name: true,
          syncSourceId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      storedCompanies.push(storedCompany);
    }

    await tx.syncSource.update({
      where: {
        companyId_id: {
          companyId,
          id: syncSourceId,
        },
      },
      data: { lastSyncedAt: now },
    });

    return storedCompanies;
  });
}

module.exports = { upsertAccountingCompanies };

