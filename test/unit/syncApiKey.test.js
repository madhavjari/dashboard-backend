const { hashString } = require("../../utils/token");
const { generateSyncApiKey } = require("../../utils/syncApiKey");

describe("generateSyncApiKey", () => {
  it("returns a prefixed high-entropy key and only its hash for storage", () => {
    const generated = generateSyncApiKey();

    expect(generated.keyPrefix).toMatch(/^sync_[a-f0-9]{12}$/);
    expect(generated.apiKey).toMatch(
      new RegExp(`^${generated.keyPrefix}\\.[A-Za-z0-9_-]{43}$`),
    );
    expect(generated.keyHash).toBe(hashString(generated.apiKey));
    expect(generated.keyHash).not.toContain(generated.apiKey);
  });

  it("generates different keys on subsequent calls", () => {
    expect(generateSyncApiKey().apiKey).not.toBe(generateSyncApiKey().apiKey);
  });
});
