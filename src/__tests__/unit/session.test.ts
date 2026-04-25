import { isValidSession } from "@/lib/session";

describe("isValidSession", () => {
  test("returns true for a valid session shape", () => {
    expect(
      isValidSession({ user: { id: "user-1", email: "a@b.com", name: "Alice" } })
    ).toBe(true);
  });

  test("returns true when name is null", () => {
    expect(isValidSession({ user: { email: "a@b.com", name: null } })).toBe(true);
  });

  test("returns false for null", () => {
    expect(isValidSession(null)).toBe(false);
  });

  test("returns false for empty object", () => {
    expect(isValidSession({})).toBe(false);
  });

  test("returns false when user is missing", () => {
    expect(isValidSession({ notUser: {} })).toBe(false);
  });

  test("returns false when email is missing from user", () => {
    expect(isValidSession({ user: { name: "Alice" } })).toBe(false);
  });

  test("returns false for a string", () => {
    expect(isValidSession("not-a-session")).toBe(false);
  });
});
