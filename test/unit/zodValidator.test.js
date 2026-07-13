const { validate } = require("../../middleware/zodValidator");
const { z } = require("zod");

describe("validate middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  test("calls next() when validation passes", async () => {
    const schema = z.object({
      body: z.object({ name: z.string() }),
    });
    req.body = { name: "Alice" };

    const middleware = validate(schema);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("returns 400 with fail status when validation fails", async () => {
    const schema = z.object({
      body: z.object({ name: z.string().min(2, "Name too short") }),
    });
    req.body = { name: "A" };

    const middleware = validate(schema);
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: "fail",
      errors: expect.objectContaining({
        name: expect.arrayContaining(["Name too short"]),
      }),
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("does not call next() when validation fails", async () => {
    const schema = z.object({
      body: z.object({ name: z.string() }),
    });
    req.body = { name: 123 };
    const middleware = validate(schema);
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  test("overwrites req.body with the parsed/transformed data", async () => {
    const schema = z.object({
      body: z.object({ email: z.string().trim().toLowerCase() }),
    });
    req.body = { email: "  TEST@Example.com  " };

    const middleware = validate(schema);
    await middleware(req, res, next);

    expect(req.body.email).toBe("test@example.com");
    expect(next).toHaveBeenCalled();
  });

  test("returns fieldErrors grouped by field name", async () => {
    const schema = z.object({
      body: z.object({
        name: z.string().min(2, "Name too short"),
        age: z.number().min(18, "Must be an adult"),
      }),
    });
    req.body = { name: "A", age: 10 };

    const middleware = validate(schema);
    await middleware(req, res, next);

    const [[responseArg]] = res.json.mock.calls;
    expect(responseArg.errors).toHaveProperty("name");
    expect(responseArg.errors).toHaveProperty("age");
  });

  test("propagates async refine validation errors (e.g. DB check)", async () => {
    const asyncCheck = jest.fn().mockResolvedValue(false);
    const schema = z.object({
      body: z.object({
        email: z.string().refine(asyncCheck, { message: "Email taken" }),
      }),
    });
    req.body = { email: "taken@example.com" };

    const middleware = validate(schema);
    await middleware(req, res, next);

    expect(asyncCheck).toHaveBeenCalledWith("taken@example.com");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test("works when schema only defines body (query/params absent)", async () => {
    const schema = z.object({
      body: z.object({ name: z.string() }),
    });
    req = {
      body: { name: "Alice" },
      query: { page: "1" },
      params: { id: "5" },
    };

    const middleware = validate(schema);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
  test("keeps error messages grouped under their correct field name (not collapsed under 'body')", async () => {
    const schema = z.object({
      body: z.object({
        name: z.string().min(2, "Name too short"),
        email: z.string().pipe(z.email("Email is invalid")),
      }),
    });
    req.body = { name: "A", email: "not-an-email" };

    const middleware = validate(schema);
    await middleware(req, res, next);

    const [[responseArg]] = res.json.mock.calls;

    expect(responseArg.errors.name).toEqual(["Name too short"]);
    expect(responseArg.errors.email).toEqual(["Email is invalid"]);
    expect(responseArg.errors.body).toBeUndefined();
  });
});
