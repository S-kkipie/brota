import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * PIN hashing for fund-movement authorization. A PIN over WhatsApp is a weak
 * factor (plaintext in transit, visible to the messaging provider) — it is a
 * deliberate-friction confirmation step for the MVP's custodial-with-limits
 * model, NOT a strong secret. We still store it hashed (scrypt + per-PIN salt)
 * and never persist the plaintext.
 */
const KEY_LEN = 32;

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
