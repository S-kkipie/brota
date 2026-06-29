/**
 * Centralized env access. Validation is lazy (on read) so that `next build`
 * never crashes when a deploy var is absent. Call `requireEnv` only where the
 * value is actually needed at runtime.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/** Public base URL used to build per-user web profile links sent by the bot. */
export const APP_BASE_URL = optionalEnv("APP_BASE_URL", "http://localhost:3002");

export const STELLAR_NETWORK = optionalEnv("STELLAR_NETWORK", "testnet");
export const STELLAR_RPC_URL = optionalEnv(
  "STELLAR_RPC_URL",
  "https://soroban-testnet.stellar.org",
);
export const STELLAR_HORIZON_URL = optionalEnv(
  "STELLAR_HORIZON_URL",
  "https://horizon-testnet.stellar.org",
);
