import { encryptApiKey, decryptApiKey } from "@/lib/encryption";

describe("API key encryption", () => {
  test("roundtrip returns original plaintext", () => {
    const plaintext = "sk-or-v1-test-key-12345";
    const encrypted = encryptApiKey(plaintext);
    expect(decryptApiKey(encrypted)).toBe(plaintext);
  });

  test("encrypted value differs from plaintext", () => {
    const plaintext = "sk-or-v1-test-key-12345";
    const encrypted = encryptApiKey(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  test("two encryptions of the same value produce different ciphertexts (random IV)", () => {
    const plaintext = "sk-or-v1-test-key-12345";
    expect(encryptApiKey(plaintext)).not.toBe(encryptApiKey(plaintext));
  });

  test("decryption with wrong key throws", () => {
    const encrypted = encryptApiKey("sk-or-v1-test-key-12345");
    expect(() => decryptApiKey(encrypted, "entirely-different-key")).toThrow();
  });

  test("decryption of malformed ciphertext throws", () => {
    expect(() => decryptApiKey("not-valid-ciphertext")).toThrow();
  });
});
