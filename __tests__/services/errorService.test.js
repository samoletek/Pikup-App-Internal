import { normalizeError } from "../../services/errorService";

describe("normalizeError", () => {
  test("supports Error instances", () => {
    const error = new Error("Boom");
    const result = normalizeError(error);
    expect(result.message).toBe("Boom");
  });

  test("supports plain strings", () => {
    const result = normalizeError("Simple error");
    expect(result.message).toBe("Simple error");
  });

  test("supports API-like objects and extracts code", () => {
    const result = normalizeError({
      message: "Request failed",
      code: "PGRST116",
    });

    expect(result).toEqual({
      message: "Request failed",
      code: "PGRST116",
    });
  });

  test("falls back when payload is empty", () => {
    const result = normalizeError(null, "Fallback error");
    expect(result.message).toBe("Fallback error");
  });
});
