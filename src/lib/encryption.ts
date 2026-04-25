import crypto from "crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function deriveKey(rawKey: string): Buffer {
  return crypto.createHash("sha256").update(rawKey).digest();
}

export function encryptApiKey(
  plaintext: string,
  rawKey = env.OPENROUTER_ENCRYPTION_KEY
): string {
  const key = deriveKey(rawKey);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptApiKey(
  ciphertext: string,
  rawKey = env.OPENROUTER_ENCRYPTION_KEY
): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }
  const [ivHex, tagHex, encryptedHex] = parts as [string, string, string];
  const key = deriveKey(rawKey);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
