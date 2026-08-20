jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

const { prisma } = require("../../lib/prisma");
const {
  upsertAccountingCompanies,
} = require("../../db/accountingCompanyQueries");

describe("upsertAccountingCompanies", () => {
  let tx;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      accountingCompany: { upsert: jest.fn() },
      syncSource: { update: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));
  });

  it("maps several external companies to one trusted computer and account", async () => {
    tx.accountingCompany.upsert
      .mockResolvedValueOnce({
        id: "books_1",
        externalId: "GUID-1",
        name: "ABC Textiles",
        syncSourceId: "source_1",
      })
      .mockResolvedValueOnce({
        id: "books_2",
        externalId: "GUID-2",
        name: "XYZ Fabrics",
        syncSourceId: "source_1",
      });
    tx.syncSource.update.mockResolvedValue({ id: "source_1" });

    const result = await upsertAccountingCompanies({
      companyId: "account_1",
      syncSourceId: "source_1",
      companies: [
        { externalCompanyId: "GUID-1", name: "ABC Textiles" },
        { externalCompanyId: "GUID-2", name: "XYZ Fabrics" },
      ],
    });

    expect(result).toHaveLength(2);
    expect(tx.accountingCompany.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          companyId_syncSourceId_externalId: {
            companyId: "account_1",
            syncSourceId: "source_1",
            externalId: "GUID-1",
          },
        },
        create: expect.objectContaining({
          companyId: "account_1",
          syncSourceId: "source_1",
        }),
      }),
    );
    expect(tx.accountingCompany.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          companyId_syncSourceId_externalId: {
            companyId: "account_1",
            syncSourceId: "source_1",
            externalId: "GUID-2",
          },
        },
      }),
    );
    expect(tx.syncSource.update).toHaveBeenCalledWith({
      where: {
        companyId_id: {
          companyId: "account_1",
          id: "source_1",
        },
      },
      data: { lastSyncedAt: expect.any(Date) },
    });
  });
});

