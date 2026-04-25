import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  test("hash/verify roundtrip succeeds for correct password", async () => {
    const hash = await hashPassword("myPassword123");
    expect(await verifyPassword("myPassword123", hash)).toBe(true);
  });

  test("wrong password fails verification", async () => {
    const hash = await hashPassword("myPassword123");
    expect(await verifyPassword("wrongPassword", hash)).toBe(false);
  });

  test("hash is not the plaintext", async () => {
    const hash = await hashPassword("myPassword123");
    expect(hash).not.toBe("myPassword123");
  });

  test("two hashes of the same password differ (salted)", async () => {
    const hash1 = await hashPassword("myPassword123");
    const hash2 = await hashPassword("myPassword123");
    expect(hash1).not.toBe(hash2);
  });
});
