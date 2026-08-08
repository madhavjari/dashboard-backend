const { prisma } = require("../lib/prisma");

const SYNC_SOURCE_MANAGERS = new Set(["OWNER", "ADMIN"]);

function mapApiKeyStatus(apiKey, now) {
  if (!apiKey) return "not_generated";
  if (apiKey.revokedAt) return "revoked";
  if (apiKey.expiresAt <= now) return "expired";
  return "active";
}

async function getCompanySyncStatus({ companyId, userId }) {
  const membership = await prisma.companyUser.findUnique({
    where: {
      companyId_userId: { companyId, userId },
    },
    select: { role: true },
  });

  if (!membership) return { status: "forbidden" };

  const now = new Date();
  const activeApiKey = await prisma.syncApiKey.findFirst({
    where: {
      companyId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      keyPrefix: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      syncSource: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          lastSyncedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeApiKey) {
    return {
      status: "ok",
      configured: true,
      credentialStatus: "active",
      canManage: SYNC_SOURCE_MANAGERS.has(membership.role),
      syncSource: activeApiKey.syncSource,
      apiKey: {
        keyPrefix: activeApiKey.keyPrefix,
        createdAt: activeApiKey.createdAt,
        expiresAt: activeApiKey.expiresAt,
        lastUsedAt: activeApiKey.lastUsedAt,
      },
    };
  }

  const syncSource = await prisma.syncSource.findFirst({
    where: { companyId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      lastSyncedAt: true,
      apiKeys: {
        select: {
          keyPrefix: true,
          createdAt: true,
          expiresAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!syncSource) {
    return {
      status: "ok",
      configured: false,
      credentialStatus: "not_configured",
      canManage: SYNC_SOURCE_MANAGERS.has(membership.role),
      syncSource: null,
      apiKey: null,
    };
  }

  const [latestApiKey] = syncSource.apiKeys;
  const { apiKeys: _apiKeys, ...sourceDetails } = syncSource;

  return {
    status: "ok",
    configured: false,
    credentialStatus: mapApiKeyStatus(latestApiKey, now),
    canManage: SYNC_SOURCE_MANAGERS.has(membership.role),
    syncSource: sourceDetails,
    apiKey: latestApiKey
      ? {
          keyPrefix: latestApiKey.keyPrefix,
          createdAt: latestApiKey.createdAt,
          expiresAt: latestApiKey.expiresAt,
          lastUsedAt: latestApiKey.lastUsedAt,
          revokedAt: latestApiKey.revokedAt,
        }
      : null,
  };
}

async function provisionSyncSource({
  companyId,
  userId,
  name,
  keyPrefix,
  keyHash,
}) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
      select: { role: true },
    });

    if (!membership || !SYNC_SOURCE_MANAGERS.has(membership.role)) {
      return { status: "forbidden" };
    }

    const now = new Date();
    const existingApiKey = await tx.syncApiKey.findFirst({
      where: {
        companyId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        keyPrefix: true,
        createdAt: true,
        expiresAt: true,
        syncSource: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingApiKey) {
      return {
        status: "exists",
        syncSource: existingApiKey.syncSource,
        apiKey: {
          keyPrefix: existingApiKey.keyPrefix,
          createdAt: existingApiKey.createdAt,
          expiresAt: existingApiKey.expiresAt,
        },
      };
    }

    let syncSource = await tx.syncSource.findFirst({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (!syncSource) {
      syncSource = await tx.syncSource.create({
        data: { companyId, name },
        select: { id: true, name: true },
      });
    }

    const apiKey = await tx.syncApiKey.create({
      data: {
        companyId,
        syncSourceId: syncSource.id,
        name: `${syncSource.name} key`,
        keyPrefix,
        keyHash,
      },
      select: {
        keyPrefix: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return {
      status: "created",
      syncSource,
      apiKey,
    };
  });
}

async function authenticateSyncApiKey(keyHash) {
  const now = new Date();
  const apiKey = await prisma.syncApiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      companyId: true,
      syncSourceId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!apiKey || apiKey.revokedAt || apiKey.expiresAt <= now) return null;

  const updateResult = await prisma.syncApiKey.updateMany({
    where: {
      id: apiKey.id,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { lastUsedAt: now },
  });

  if (updateResult.count !== 1) return null;

  return {
    apiKeyId: apiKey.id,
    companyId: apiKey.companyId,
    syncSourceId: apiKey.syncSourceId,
  };
}

module.exports = {
  getCompanySyncStatus,
  provisionSyncSource,
  authenticateSyncApiKey,
};
