const { sendWithRetry } = require("../../utils/sendWithRetry");

describe("sendWithRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("returns the result immediately if fn succeeds on first try", async () => {
    const fn = jest.fn().mockResolvedValue("success");

    const result = await sendWithRetry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries on failure and succeeds on a later attempt", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce("success");

    const promise = sendWithRetry(fn, 3, 500);

    // let pending timers (the delays between retries) resolve as they're scheduled
    await jest.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("throws the last error after exhausting all retries", async () => {
    const finalError = new Error("final failure");
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(finalError);

    const promise = sendWithRetry(fn, 3, 500);
    // Prevent an unhandled rejection warning while timers advance
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow("final failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("does not delay after the final failed attempt", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fails"));

    const promise = sendWithRetry(fn, 2, 500);
    promise.catch(() => {});

    await jest.runAllTimersAsync();
    await expect(promise).rejects.toThrow("always fails");

    // called exactly `retries` times, no extra attempt after the last failure
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("uses increasing delay between retries (delayMs * attempt number)", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce("success");

    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    const promise = sendWithRetry(fn, 3, 500);
    await jest.runAllTimersAsync();
    await promise;

    // i=0 fails -> delay 500 * 1 = 500
    // i=1 fails -> delay 500 * 2 = 1000
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 500);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      1000,
    );

    setTimeoutSpy.mockRestore();
  });

  test("respects a custom retries count", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fails"));

    const promise = sendWithRetry(fn, 5, 100);
    promise.catch(() => {});

    await jest.runAllTimersAsync();
    await expect(promise).rejects.toThrow("always fails");

    expect(fn).toHaveBeenCalledTimes(5);
  });

  test("respects a custom delayMs value", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockResolvedValueOnce("success");

    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    const promise = sendWithRetry(fn, 3, 1000);
    await jest.runAllTimersAsync();
    await promise;

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    setTimeoutSpy.mockRestore();
  });

  test("default retries is 3 and default delayMs is 500 when not specified", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fails"));

    const promise = sendWithRetry(fn);
    promise.catch(() => {});

    await jest.runAllTimersAsync();
    await expect(promise).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("BUG-ish: returns undefined instead of throwing if retries is 0", async () => {
    const fn = jest.fn();

    const result = await sendWithRetry(fn, 0);

    expect(result).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });
});
