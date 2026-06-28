import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Keypair } from "@stellar/stellar-sdk";
import { db } from "@/lib/db";
import { transactions, positions } from "@/db/schema";
import type { User } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { ensureWalletForUser } from "@/lib/wallet";
import { depositToVault, getVaultPosition } from "@/lib/defindex";
import { requireEnv } from "@/lib/env";
import { setPending } from "@/lib/pending";
import { log } from "@/lib/log";
import type { ActionContext, ActionResult } from "@/lib/actions/types";

/**
 * Deposit flow (custodial-with-limits). The handler only INITIATES: it queues
 * the amount behind a PIN step. The actual fund movement runs in executeDeposit
 * once the PIN is verified by the conversation state machine — the AI never
 * moves funds on its own.
 */
export async function handleDeposit(ctx: ActionContext): Promise<ActionResult> {
  const { intent, user } = ctx;
  log.info("deposit requested", { amountUsdc: intent.amountUsdc });

  if (!intent.amountUsdc) {
    return { reply: 'Cuánto te gustaría ahorrar? Por ejemplo: "ahorra 50".' };
  }
  const amountUsdc = intent.amountUsdc;

  if (!user.pinHash) {
    await setPending(user.id, { step: "AWAIT_NEW_PIN", amountUsdc });
    return {
      reply:
        `Para guardar tus ${amountUsdc} USDC primero crea un PIN de 4 dígitos. ` +
        `Escríbeme tu nuevo PIN (solo números, ej: 1234).`,
    };
  }

  await setPending(user.id, { step: "AWAIT_PIN", amountUsdc });
  return {
    reply: `Confirma tu ahorro de ${amountUsdc} USDC escribiéndome tu PIN.`,
  };
}

/**
 * Execute the deposit on-chain. Called only after PIN verification. Decrypts
 * the user's seed in memory, deposits via DeFindex, then records the tx and a
 * fresh position snapshot.
 */
export async function executeDeposit(
  user: User,
  amountUsdc: number,
): Promise<ActionResult> {
  const wallet = await ensureWalletForUser(user.id);
  const keypair = Keypair.fromSecret(decryptSecret(wallet.encryptedSecret));
  const vaultId = requireEnv("DEFINDEX_VAULT_ID");

  const { txHash } = await depositToVault(keypair, vaultId, amountUsdc);

  await db.insert(transactions).values({
    id: `tx_${randomUUID()}`,
    userId: user.id,
    type: "deposit",
    amount: amountUsdc,
    asset: "USDC",
    stellarTxHash: txHash,
    status: "confirmed",
    createdAt: new Date(),
  });

  const position = await getVaultPosition(wallet.stellarPublicKey, vaultId);
  await upsertPosition(user.id, vaultId, position.shares, position.valueUsdc);

  log.info("deposit executed", { userId: user.id, amountUsdc, txHash });
  return {
    reply:
      `Listo 🌱 ahorraste ${amountUsdc} USDC. ` +
      `Tu saldo actual es ${position.valueUsdc.toFixed(2)} USDC. ` +
      `Escribe "saldo" cuando quieras ver cómo crece.`,
  };
}

async function upsertPosition(
  userId: string,
  vaultId: string,
  shares: number,
  valueUsdc: number,
): Promise<void> {
  const existing = await db.query.positions.findFirst({
    where: and(eq(positions.userId, userId), eq(positions.vaultId, vaultId)),
  });
  if (existing) {
    await db
      .update(positions)
      .set({ shares, lastValueUsdc: valueUsdc, updatedAt: new Date() })
      .where(eq(positions.id, existing.id));
    return;
  }
  await db.insert(positions).values({
    id: `pos_${randomUUID()}`,
    userId,
    vaultId,
    shares,
    lastValueUsdc: valueUsdc,
    updatedAt: new Date(),
  });
}
