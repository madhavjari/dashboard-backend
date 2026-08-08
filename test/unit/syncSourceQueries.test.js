jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    companyUser: { findUnique: jest.fn() },
    syncSource: { findFirst: jest.fn() },
    syncApiKey: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const { prisma } = require("../../lib/prisma");
const {
  authenticateSyncApiKey,
  getCompanySyncStatus,
  provisionSyncSource,
} = require("../../db/syncSourceQueries");

const input = {
  companyId: "company_1",
  userId: "user_1",
  name: "Main office PC",
  keyPrefix: "sync_abc123",
  keyHash: "hashed-secret-value",
};

let tx;

beforeEach(() => {
  jest.clearAllMocks();
  tx = {
    companyUser: { findUnique: jest.fn() },
    syncSource: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    syncApiKey: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  prisma.$transaction.mockImplementation((callback) => callback(tx));
});

describe("provisionSyncSource", () => {
  it("rejects a user who is not a company member", async () => {
    tx.companyUser.findUnique.mockResolvedValue(null);

    const result = await provisionSyncSource(input);

    expect(result).toEqual({ status: "forbidden" });
    expect(tx.syncApiKey.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a member without owner or admin role", async () => {
    tx.companyUser.findUnique.mockResolvedValue({ role: "ACCOUNTANT" });

    const result = await provisionSyncSource(input);

    expect(result).toEqual({ status: "forbidden" });
    expect(tx.syncApiKey.findFirst).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN"])(
    "allows a %s to create the first source and key",
    async (role) => {
      const createdAt = new Date("2026-08-08T12:00:00.000Z");
      const expiresAt = new Date("2027-08-08T12:00:00.000Z");
      tx.companyUser.findUnique.mockResolvedValue({ role });
      tx.syncApiKey.findFirst.mockResolvedValue(null);
      tx.syncSource.findFirst.mockResolvedValue(null);
      tx.syncSource.create.mockResolvedValue({
        id: "source_1",
        name: input.name,
      });
      tx.syncApiKey.create.mockResolvedValue({
        keyPrefix: input.keyPrefix,
        createdAt,
        expiresAt,
      });

      const result = await provisionSyncSource(input);

      expect(result.status).toBe("created");
      expect(tx.syncSource.create).toHaveBeenCalledWith({
        data: { companyId: input.companyId, name: input.name },
        select: { id: true, name: true },
      });
      expect(tx.syncApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: input.companyId,
            syncSourceId: "source_1",
            keyPrefix: input.keyPrefix,
            keyHash: input.keyHash,
          }),
        }),
      );
    },
  );

  it("returns safe metadata when an active key already exists", async () => {
    const existingApiKey = {
      keyPrefix: "sync_existing",
      createdAt: new Date("2026-08-08T12:00:00.000Z"),
      expiresAt: new Date("2027-08-08T12:00:00.000Z"),
      syncSource: { id: "source_1", name: "Main office PC" },
    };
    tx.companyUser.findUnique.mockResolvedValue({ role: "OWNER" });
    tx.syncApiKey.findFirst.mockResolvedValue(existingApiKey);

    const result = await provisionSyncSource(input);

    expect(result).toEqual({
      status: "exists",
      syncSource: existingApiKey.syncSource,
      apiKey: {
        keyPrefix: existingApiKey.keyPrefix,
        createdAt: existingApiKey.createdAt,
        expiresAt: existingApiKey.expiresAt,
      },
    });
    expect(tx.syncSource.findFirst).not.toHaveBeenCalled();
    expect(tx.syncApiKey.create).not.toHaveBeenCalled();
  });

  it("reuses a source whose previous keys are no longer active", async () => {
    tx.companyUser.findUnique.mockResolvedValue({ role: "OWNER" });
    tx.syncApiKey.findFirst.mockResolvedValue(null);
    tx.syncSource.findFirst.mockResolvedValue({
      id: "source_1",
      name: "Main office PC",
    });
    tx.syncApiKey.create.mockResolvedValue({
      keyPrefix: input.keyPrefix,
      createdAt: new Date("2026-08-08T12:00:00.000Z"),
      expiresAt: new Date("2027-08-08T12:00:00.000Z"),
    });

    const result = await provisionSyncSource(input);

    expect(result.status).toBe("created");
    expect(tx.syncSource.create).not.toHaveBeenCalled();
    expect(tx.syncApiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncSourceId: "source_1" }),
      }),
    );
  });
});

describe("getCompanySyncStatus", () => {
  it("rejects a user who is not a company member", async () => {
    prisma.companyUser.findUnique.mockResolvedValue(null);

    await expect(
      getCompanySyncStatus({
        companyId: input.companyId,
        userId: input.userId,
      }),
    ).resolves.toEqual({ status: "forbidden" });
    expect(prisma.syncApiKey.findFirst).not.toHaveBeenCalled();
  });

  it("returns not configured when the company has no source", async () => {
    prisma.companyUser.findUnique.mockResolvedValue({ role: "OWNER" });
    prisma.syncApiKey.findFirst.mockResolvedValue(null);
    prisma.syncSource.findFirst.mockResolvedValue(null);

    const result = await getCompanySyncStatus({
      companyId: input.companyId,
      userId: input.userId,
    });

    expect(result).toEqual({
      status: "ok",
      configured: false,
      credentialStatus: "not_configured",
      canManage: true,
      syncSource: null,
      apiKey: null,
    });
  });

  it("returns an active credential with safe metadata", async () => {
    const activeApiKey = {
      keyPrefix: "sync_active",
      createdAt: new Date(Date.now() - 1_000),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: null,
      revokedAt: null,
      syncSource: {
        id: "source_1",
        name: "Main office PC",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: null,
      },
    };
    prisma.companyUser.findUnique.mockResolvedValue({ role: "ADMIN" });
    prisma.syncApiKey.findFirst.mockResolvedValue(activeApiKey);

    const result = await getCompanySyncStatus({
      companyId: input.companyId,
      userId: input.userId,
    });

    expect(result.status).toBe("ok");
    expect(result.configured).toBe(true);
    expect(result.credentialStatus).toBe("active");
    expect(result.canManage).toBe(true);
    expect(result.apiKey).not.toHaveProperty("keyHash");
  });

  it("reports the latest inactive credential to a viewer", async () => {
    const revokedAt = new Date();
    prisma.companyUser.findUnique.mockResolvedValue({ role: "VIEWER" });
    prisma.syncApiKey.findFirst.mockResolvedValue(null);
    prisma.syncSource.findFirst.mockResolvedValue({
      id: "source_1",
      name: "Main office PC",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: null,
      apiKeys: [
        {
          keyPrefix: "sync_revoked",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          lastUsedAt: null,
          revokedAt,
        },
      ],
    });

    const result = await getCompanySyncStatus({
      companyId: input.companyId,
      userId: input.userId,
    });

    expect(result.configured).toBe(false);
    expect(result.credentialStatus).toBe("revoked");
    expect(result.canManage).toBe(false);
    expect(result.apiKey.revokedAt).toBe(revokedAt);
  });
});

describe("authenticateSyncApiKey", () => {
  it("rejects an unknown key", async () => {
    prisma.syncApiKey.findUnique.mockResolvedValue(null);

    await expect(authenticateSyncApiKey("unknown-hash")).resolves.toBeNull();
    expect(prisma.syncApiKey.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "revoked",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      name: "expired",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    },
  ])("rejects a $name key", async ({ revokedAt, expiresAt }) => {
    prisma.syncApiKey.findUnique.mockResolvedValue({
      id: "key_1",
      companyId: "company_1",
      syncSourceId: "source_1",
      revokedAt,
      expiresAt,
    });

    await expect(authenticateSyncApiKey("inactive-hash")).resolves.toBeNull();
    expect(prisma.syncApiKey.updateMany).not.toHaveBeenCalled();
  });

  it("returns trusted tenant context and records key usage", async () => {
    prisma.syncApiKey.findUnique.mockResolvedValue({
      id: "key_1",
      companyId: "company_1",
      syncSourceId: "source_1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.syncApiKey.updateMany.mockResolvedValue({ count: 1 });

    const result = await authenticateSyncApiKey("valid-hash");

    expect(result).toEqual({
      apiKeyId: "key_1",
      companyId: "company_1",
      syncSourceId: "source_1",
    });
    expect(prisma.syncApiKey.updateMany).toHaveBeenCalledWith({
      where: {
        id: "key_1",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("rejects a key revoked while authentication is in progress", async () => {
    prisma.syncApiKey.findUnique.mockResolvedValue({
      id: "key_1",
      companyId: "company_1",
      syncSourceId: "source_1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.syncApiKey.updateMany.mockResolvedValue({ count: 0 });

    await expect(authenticateSyncApiKey("raced-hash")).resolves.toBeNull();
  });
});
