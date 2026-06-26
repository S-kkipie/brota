import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { requireEnv } from "@/lib/env";

/**
 * AES-256-GCM encryption for Stellar secret seeds at rest.
 *
 * The key comes from WALLET_ENCRYPTION_KEY (64 hex chars = 32 bytes). Generate
 * one with: `openssl rand -hex 32`. NEVER commit the key — it lives in .env /
 * Railway only (see AGENTS.md security rules).
 *
 * Ciphertext format (base64): iv(12) || authTag(16) || ciphertext.
 */
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function key(): Buffer {
  const hex = requireEnv("WALLET_ENCRYPTION_KEY");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Run: openssl rand -hex 32",
    );
  }
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
