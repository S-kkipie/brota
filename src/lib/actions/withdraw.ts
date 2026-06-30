import { randomUUID } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { db } from "@/lib/db";
import { transactions } from "@/db/schema";
import type { User } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { ensureWalletForUser } from "@/lib/wallet";
import { withdrawFromVault, getVaultPosition } from "@/lib/defindex";
import { requireEnv } from "@/lib/env";
import { setPending } from "@/lib/pending";
import { upsertPosition } from "@/lib/position-snapshot";
import { log } from "@/lib/log";
import type { ActionContext, ActionResult } from "@/lib/actions/types";

/**
 * Withdraw flow (custodial-with-limits). Mirror of deposit: the handler only
 * INITIATES, queuing the amount behind a PIN step. The actual fund movement
 * runs in executeWithdraw once the PIN is verified — the AI never moves funds
 * on its own. Funds return to the user's custodial wallet as USDC (testnet);
 * there is no fiat off-ramp in the MVP.
 */
export async function handleWithdraw(ctx: ActionContext): Promise<ActionResult> {
  const { intent, user } = ctx;
  log.info("withdraw requested", { amountUsdc: intent.amountUsdc });

  if (!intent.amountUsdc) {
    return { reply: 'Cuánto quieres retirar? Por ejemplo: "retira 20".' };
  }
  const amountUsdc = intent.amountUsdc;

  // No PIN means the user never deposited — nothing to withdraw.
  if (!user.pinHash) {
    return {
      reply: 'Aún no tienes ahorros para retirar. Escribe "ahorra 50" para empezar 🌱.',
    };
  }

  await setPending(user.id, { step: "AWAIT_PIN", kind: "withdraw", amountUsdc });
  return {
    reply: `Confirma tu retiro de ${amountUsdc} USDC escribiéndome tu PIN.`,
  };
}

/**
 * Execute the withdrawal on-chain. Called only after PIN verification. Decrypts
 * the user's seed in memory, withdraws via DeFindex back to the custodial
 * wallet, then records the tx and a fresh position snapshot.
 */
export async function executeWithdraw(
  user: User,
  amountUsdc: number,
): Promise<ActionResult> {
  const wallet = await ensureWalletForUser(user.id);
  const keypair = Keypair.fromSecret(decryptSecret(wallet.encryptedSecret));
  const vaultId = requireEnv("DEFINDEX_VAULT_ID");

  const { txHash } = await withdrawFromVault(keypair, vaultId, amountUsdc);

  await db.insert(transactions).values({
    id: `tx_${randomUUID()}`,
    userId: user.id,
    type: "withdraw",
    amount: amountUsdc,
    asset: "USDC",
    stellarTxHash: txHash,
    status: "confirmed",
    createdAt: new Date(),
  });

  const position = await getVaultPosition(wallet.stellarPublicKey, vaultId);
  await upsertPosition(user.id, vaultId, position.shares, position.valueUsdc);

  log.info("withdraw executed", { userId: user.id, amountUsdc, txHash });
  return {
    reply:
      `Listo 💸 retiraste ${amountUsdc} USDC a tu billetera. ` +
      `Tu ahorro restante vale ${position.valueUsdc.toFixed(2)} USDC.`,
  };
}
