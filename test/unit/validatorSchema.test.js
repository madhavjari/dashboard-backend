jest.mock("../../db/authQueries");
const { registerSchema } = require("../../schema/validatorSchema");
const { findUser } = require("../../db/authQueries");

const validRegisterBody = {
  firstName: "John",
  lastName: "Doe",
  email: "John.Doe@Example.com",
  companyName: "Acme Inc",
  phoneNumber: "+919876543210",
  password: "Passw0rd!",
  confirmPassword: "Passw0rd!",
};

describe("registerSchema", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue(false); // default: email not taken
  });

  test("passes with valid data", async () => {
    const result = await registerSchema.safeParseAsync({
      body: validRegisterBody,
    });
    expect(result.success).toBe(true);
  });

  test("lowercases and trims email", async () => {
    const result = await registerSchema.safeParseAsync({
      body: { ...validRegisterBody, email: "  John.Doe@Example.com  " },
    });

    expect(result.success).toBe(true);
    expect(result.data.body.email).toBe("john.doe@example.com");
  });

  test("fails when email already exists", async () => {
    findUser.mockResolvedValue(true);
    const result = await registerSchema.safeParseAsync({
      body: validRegisterBody,
    });
    expect(result.success).toBe(false);
    const emailError = result.error.issues.find((i) =>
      i.path.includes("email"),
    );
    expect(emailError.message).toBe("Email already taken");
  });

  test("calls findUser with the normalized (lowercased/trimmed) email", async () => {
    await registerSchema.safeParseAsync({
      body: { ...validRegisterBody, email: "  John.Doe@Example.com  " },
    });
    expect(findUser).toHaveBeenCalledWith(["id"], {
      email: "john.doe@example.com",
    });
  });

  describe("firstName", () => {
    test("rejects when too short", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, firstName: "J" },
      });
      expect(result.success).toBe(false);
    });

    test("rejects when too long", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, firstName: "J".repeat(33) },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("lastName", () => {
    test("rejects when too short", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, lastName: "D" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("companyName", () => {
    test("rejects when too short", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, companyName: "A" },
      });
      expect(result.success).toBe(false);
    });

    test("trims whitespace", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, companyName: "  Acme Inc  " },
      });
      expect(result.success).toBe(true);
      expect(result.data.body.companyName).toBe("Acme Inc");
    });
  });

  describe("phoneNumber", () => {
    test("accepts valid +91 number", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, phoneNumber: "+911234567890" },
      });
      expect(result.success).toBe(true);
    });

    test("rejects missing country code", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, phoneNumber: "9876543210" },
      });
      expect(result.success).toBe(false);
    });

    test("rejects wrong country code", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, phoneNumber: "+19876543210" },
      });
      expect(result.success).toBe(false);
    });

    test("rejects too few digits", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, phoneNumber: "+9198765432" },
      });
      expect(result.success).toBe(false);
    });

    test("rejects too many digits", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, phoneNumber: "+9198765432100" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("password", () => {
    const cases = [
      ["too short", "Pw0!"],
      ["missing uppercase", "password0!"],
      ["missing lowercase", "PASSWORD0!"],
      ["missing number", "Password!"],
      ["missing special char", "Password0"],
      ["too long", "P" + "a".repeat(30) + "0!"],
    ];

    test.each(cases)(
      "rejects password that is %s",
      async (_label, password) => {
        const result = await registerSchema.safeParseAsync({
          body: { ...validRegisterBody, password, confirmPassword: password },
        });
        expect(result.success).toBe(false);
      },
    );

    test("accepts a valid strong password", async () => {
      const result = await registerSchema.safeParseAsync({
        body: {
          ...validRegisterBody,
          password: "Str0ng!Pw",
          confirmPassword: "Str0ng!Pw",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("confirmPassword", () => {
    test("rejects when passwords do not match", async () => {
      const result = await registerSchema.safeParseAsync({
        body: { ...validRegisterBody, confirmPassword: "Different0!" },
      });
      expect(result.success).toBe(false);
      const error = result.error.issues.find(
        (i) => i.message === "Passwords do not match",
      );
      expect(error).toBeDefined();
      expect(error.path).toContain("confirmPassword");
    });
  });
});
