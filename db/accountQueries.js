const { prisma } = require("../lib/prisma");

const SYNC_SOURCE_MANAGERS = new Set(["OWNER", "ADMIN"]);

//checks companies current status. if the current time is
// greater than the status time in the database,
// it changes the status
function resolveSubscription(company, now) {
  if (company.subscriptionStatus === "TRIAL") {
    const trialIsActive =
      company.trialEndsAt instanceof Date && company.trialEndsAt > now;

    return {
      status: trialIsActive ? "TRIAL" : "EXPIRED",
      canViewLiveData: trialIsActive,
      reason: trialIsActive ? null : "TRIAL_EXPIRED",
    };
  }

  if (company.subscriptionStatus === "ACTIVE") {
    const subscriptionIsActive =
      !company.subscriptionEndsAt || company.subscriptionEndsAt > now;

    return {
      status: subscriptionIsActive ? "ACTIVE" : "EXPIRED",
      canViewLiveData: subscriptionIsActive,
      reason: subscriptionIsActive ? null : "SUBSCRIPTION_EXPIRED",
    };
  }

  const reasons = {
    PENDING: "PAYMENT_REQUIRED",
    EXPIRED: "SUBSCRIPTION_EXPIRED",
    SUSPENDED: "SUBSCRIPTION_SUSPENDED",
  };

  return {
    status: company.subscriptionStatus,
    canViewLiveData: false,
    reason: reasons[company.subscriptionStatus] || "PAYMENT_REQUIRED",
  };
}

function mapAccount(membership, now) {
  const { company, role } = membership;
  const subscriptionAccess = resolveSubscription(company, now);
  const syncSources = company.syncSources.map((source) => ({
    id: source.id,
    name: source.name,
    lastSyncedAt: source.lastSyncedAt,
    hasActiveApiKey: source.apiKeys.length > 0,
  }));
  const hasActiveApiKey = syncSources.some((source) => source.hasActiveApiKey);
  const accountingCompanies = company.syncSources.flatMap((source) =>
    source.accountingCompanies.map((accountingCompany) => ({
      ...accountingCompany,
      syncSourceId: source.id,
    })),
  );

  return {
    id: company.id,
    name: company.name,
    role,
    canManageSync: SYNC_SOURCE_MANAGERS.has(role),
    subscription: {
      status: subscriptionAccess.status,
      trialStartedAt: company.trialStartedAt,
      trialEndsAt: company.trialEndsAt,
      subscriptionStartedAt: company.subscriptionStartedAt,
      subscriptionEndsAt: company.subscriptionEndsAt,
    },
    sync: {
      configured: hasActiveApiKey,
      sources: syncSources,
    },
    accountingCompanies,
    access: {
      canViewLiveData: hasActiveApiKey && subscriptionAccess.canViewLiveData,
      reason: hasActiveApiKey
        ? subscriptionAccess.reason
        : "SYNC_SETUP_REQUIRED",
      canViewDemo: true,
    },
  };
}

async function getUserAccountAccess(userId, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerified: true,
      companies: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          company: {
            select: {
              id: true,
              name: true,
              subscriptionStatus: true,
              trialStartedAt: true,
              trialEndsAt: true,
              subscriptionStartedAt: true,
              subscriptionEndsAt: true,
              syncSources: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  name: true,
                  lastSyncedAt: true,
                  apiKeys: {
                    where: {
                      revokedAt: null,
                      expiresAt: { gt: now },
                    },
                    select: { id: true },
                    take: 1,
                  },
                  accountingCompanies: {
                    orderBy: { name: "asc" },
                    select: {
                      id: true,
                      externalId: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isVerified: user.emailVerified,
    },
    accounts: user.companies.map((membership) => mapAccount(membership, now)),
  };
}

module.exports = {
  getUserAccountAccess,
  resolveSubscription,
};
