import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { wallets } from "@/db/schema";
import type { Wallet } from "@/db/schema";
import { generateWallet, isTestnet } from "@/lib/stellar";
import { encryptSecret } from "@/lib/crypto";
import { log } from "@/lib/log";

/**
 * Create and persist a custodial-with-limits wallet for a user.
 *
 * The Stellar secret seed is AES-256-GCM encrypted at rest (lib/crypto.ts);
 * the plaintext seed never touches the DB or the logs. On testnet the account
 * is funded via friendbot so it exists on-ledger for later deposits — funding
 * failure is non-fatal (best effort).
 *
 * Requires WALLET_ENCRYPTION_KEY at runtime; it intentionally throws if absent.
 */
export async function createWalletForUser(userId: string): Promise<Wallet> {
  const { publicKey, secret } = generateWallet();
  const encryptedSecret = encryptSecret(secret);

  const [wallet] = await db
    .insert(wallets)
    .values({
      id: `wal_${randomUUID()}`,
      userId,
      stellarPublicKey: publicKey,
      encryptedSecret,
      createdAt: new Date(),
    })
    .returning();

  log.info("wallet created", { userId, stellarPublicKey: publicKey });

  if (isTestnet) {
    await fundTestnetAccount(publicKey);
  }

  return wallet;
}

export function getWalletForUser(userId: string): Promise<Wallet | undefined> {
  return db.query.wallets.findFirst({ where: eq(wallets.userId, userId) });
}

/**
 * Ensure a user has a wallet, creating one on first need. Lets users who
 * predate wallet wiring (or whose creation raced) still get one.
 */
export async function ensureWalletForUser(userId: string): Promise<Wallet> {
  const existing = await getWalletForUser(userId);
  return existing ?? createWalletForUser(userId);
}

async function fundTestnetAccount(publicKey: string): Promise<void> {
  try {
    const res = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
    if (!res.ok) {
      log.warn("friendbot funding failed", { publicKey, status: res.status });
      return;
    }
    log.info("testnet account funded", { publicKey });
  } catch (err) {
    log.warn("friendbot funding error", { publicKey, err: String(err) });
  }
}
