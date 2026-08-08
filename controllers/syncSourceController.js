const {
  getCompanySyncStatus,
  provisionSyncSource,
} = require("../db/syncSourceQueries");
const { generateSyncApiKey } = require("../utils/syncApiKey");

async function postSyncSource(req, res) {
  try {
    if (!req.user.emailVerified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before generating a sync API key.",
      });
    }

    const { companyId } = req.params;
    const { name } = req.body;
    const generatedKey = generateSyncApiKey();

    const result = await provisionSyncSource({
      companyId,
      userId: req.user.id,
      name,
      keyPrefix: generatedKey.keyPrefix,
      keyHash: generatedKey.keyHash,
    });

    if (result.status === "forbidden") {
      return res.status(403).json({
        code: "SYNC_SOURCE_FORBIDDEN",
        message: "Only a company owner or admin can generate a sync API key.",
      });
    }

    if (result.status === "exists") {
      return res.status(409).json({
        code: "SYNC_API_KEY_EXISTS",
        message:
          "An active sync API key already exists for this company. The existing secret cannot be displayed again.",
        syncSource: result.syncSource,
        apiKey: result.apiKey,
      });
    }

    return res.status(201).json({
      message:
        "Sync API key generated. Copy it now; it will not be displayed again.",
      syncSource: result.syncSource,
      apiKey: {
        value: generatedKey.apiKey,
        keyPrefix: result.apiKey.keyPrefix,
        createdAt: result.apiKey.createdAt,
        expiresAt: result.apiKey.expiresAt,
      },
    });
  } catch (error) {
    console.error("Failed to create sync source:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getSyncSourceStatus(req, res) {
  try {
    const result = await getCompanySyncStatus({
      companyId: req.params.companyId,
      userId: req.user.id,
    });

    if (result.status === "forbidden") {
      return res.status(403).json({
        code: "SYNC_SOURCE_FORBIDDEN",
        message: "You do not have access to this company.",
      });
    }

    const { status: _status, ...syncStatus } = result;
    return res.status(200).json(syncStatus);
  } catch (error) {
    console.error("Failed to get sync source status:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { getSyncSourceStatus, postSyncSource };
