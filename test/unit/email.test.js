const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("email utils", () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      RESEND_API_KEY: "test-api-key",
      CLIENT_URL: "https://example.com",
      EMAIL_FROM: "noreply@example.com",
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe("sendVerificationEmail", () => {
    test("calls resend.emails.send with correct fields", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendVerificationEmail } = require("../../services/email");

      await sendVerificationEmail("user@test.com", "abc123");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@example.com",
          to: "user@test.com",
          subject: "New Sign-up, Verify your email",
        }),
      );
    });
    test("includes the correct verification URL with token in the HTML body", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendVerificationEmail } = require("../../services/email");

      await sendVerificationEmail("user@test.com", "abc123");

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain(
        "https://example.com/verify-email?token=abc123",
      );
    });

    test("mentions the 1 hour expiry in the email body", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendVerificationEmail } = require("../../services/email");

      await sendVerificationEmail("user@test.com", "abc123");

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain("expires in 1 hour");
    });

    test("returns data on success", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { sendVerificationEmail } = require("../../services/email");

      const result = await sendVerificationEmail("user@test.com", "abc123");

      expect(result).toEqual({ id: "email-1" });
    });

    test("throws the error when resend returns an error", async () => {
      const fakeError = { message: "Invalid API key" };
      mockSend.mockResolvedValue({ data: null, error: fakeError });
      const { sendVerificationEmail } = require("../../services/email");

      await expect(
        sendVerificationEmail("user@test.com", "abc123"),
      ).rejects.toEqual(fakeError);
    });

    test("propagates a network/unexpected rejection from resend", async () => {
      mockSend.mockRejectedValue(new Error("network down"));
      const { sendVerificationEmail } = require("../../services/email");

      await expect(
        sendVerificationEmail("user@test.com", "abc123"),
      ).rejects.toThrow("network down");
    });
  });

  describe("sendPasswordResetEmail", () => {
    test("calls resend.emails.send with correct fields", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendPasswordResetEmail } = require("../../services/email");

      await sendPasswordResetEmail("user@test.com", "xyz789");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@example.com",
          to: "user@test.com",
          subject: "Reset your password",
        }),
      );
    });

    test("includes the correct reset URL with token in the HTML body", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendPasswordResetEmail } = require("../../services/email");

      await sendPasswordResetEmail("user@test.com", "xyz789");

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain(
        "https://example.com/password-reset?token=xyz789",
      );
    });

    test("mentions the 30 minute expiry in the email body", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendPasswordResetEmail } = require("../../services/email");

      await sendPasswordResetEmail("user@test.com", "xyz789");

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain("expires in 30 minutes");
    });

    test("returns data on success", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });
      const { sendPasswordResetEmail } = require("../../services/email");

      const result = await sendPasswordResetEmail("user@test.com", "xyz789");

      expect(result).toEqual({ id: "email-2" });
    });

    test("throws the error when resend returns an error", async () => {
      const fakeError = { message: "Rate limited" };
      mockSend.mockResolvedValue({ data: null, error: fakeError });
      const { sendPasswordResetEmail } = require("../../services/email");

      await expect(
        sendPasswordResetEmail("user@test.com", "xyz789"),
      ).rejects.toEqual(fakeError);
    });

    test("propagates a network/unexpected rejection from resend", async () => {
      mockSend.mockRejectedValue(new Error("network down"));
      const { sendPasswordResetEmail } = require("../../services/email");

      await expect(
        sendPasswordResetEmail("user@test.com", "xyz789"),
      ).rejects.toThrow("network down");
    });
  });
  test("Resend is instantiated with the API key from env", () => {
    const { Resend } = require("resend");
    require("../../services/email");
    expect(Resend).toHaveBeenCalledWith("test-api-key");
  });
});
