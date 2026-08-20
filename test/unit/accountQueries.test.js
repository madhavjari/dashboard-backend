jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

const { prisma } = require("../../lib/prisma");
const {
  getUserAccountAccess,
  resolveSubscription,
} = require("../../db/accountQueries");

function createCompany(overrides = {}) {
  return {
    id: "account_1",
    name: "Textile Group",
    subscriptionStatus: "PENDING",
    trialStartedAt: null,
    trialEndsAt: null,
    subscriptionStartedAt: null,
    subscriptionEndsAt: null,
    syncSources: [],
    ...overrides,
  };
}

describe("resolveSubscription", () => {
  const now = new Date("2026-08-13T00:00:00.000Z");

  it("allows an active trial", () => {
    expect(
      resolveSubscription(
        createCompany({
          subscriptionStatus: "TRIAL",
          trialEndsAt: new Date("2026-09-12T00:00:00.000Z"),
        }),
        now,
      ),
    ).toEqual({
      status: "TRIAL",
      canViewLiveData: true,
      reason: null,
    });
  });

  it("treats an ended trial as expired", () => {
    expect(
      resolveSubscription(
        createCompany({
          subscriptionStatus: "TRIAL",
          trialEndsAt: new Date("2026-08-12T00:00:00.000Z"),
        }),
        now,
      ),
    ).toEqual({
      status: "EXPIRED",
      canViewLiveData: false,
      reason: "TRIAL_EXPIRED",
    });
  });
});

describe("getUserAccountAccess", () => {
  const now = new Date("2026-08-13T00:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns setup-required access when the computer has no active key", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      companies: [
        {
          role: "OWNER",
          company: createCompany(),
        },
      ],
    });

    const result = await getUserAccountAccess("user_1", now);

    expect(result.accounts[0]).toEqual(
      expect.objectContaining({
        id: "account_1",
        canManageSync: true,
        sync: { configured: false, sources: [] },
        access: {
          canViewLiveData: false,
          reason: "SYNC_SETUP_REQUIRED",
          canViewDemo: true,
        },
      }),
    );
  });

  it("allows live data for all discovered companies during an active trial", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      companies: [
        {
          role: "ACCOUNTANT",
          company: createCompany({
            subscriptionStatus: "TRIAL",
            trialStartedAt: now,
            trialEndsAt: new Date("2026-09-12T00:00:00.000Z"),
            syncSources: [
              {
                id: "source_1",
                name: "Office PC",
                lastSyncedAt: now,
                apiKeys: [{ id: "key_1" }],
                accountingCompanies: [
                  {
                    id: "books_1",
                    externalId: "GUID-1",
                    name: "ABC Textiles",
                  },
                  {
                    id: "books_2",
                    externalId: "GUID-2",
                    name: "XYZ Fabrics",
                  },
                ],
              },
            ],
          }),
        },
      ],
    });

    const result = await getUserAccountAccess("user_1", now);
    const [account] = result.accounts;

    expect(account.subscription.status).toBe("TRIAL");
    expect(account.sync.configured).toBe(true);
    expect(account.accountingCompanies).toHaveLength(2);
    expect(account.accountingCompanies[0].syncSourceId).toBe("source_1");
    expect(account.access).toEqual({
      canViewLiveData: true,
      reason: null,
      canViewDemo: true,
    });
  });
});

