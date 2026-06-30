import { ensureWalletForUser } from "@/lib/wallet";
import { isTestnet } from "@/lib/stellar";
import { log } from "@/lib/log";
import type { ActionContext, ActionResult } from "@/lib/actions/types";

/**
 * Show the user their custodial Stellar address plus the funding steps. On
 * mainnet the account starts empty (no friendbot), so the user must first send
 * XLM to activate it, then "activar" to add the USDC trustline, then send USDC.
 * On testnet the account is already friendbot-funded, so we only show the
 * address for receiving the testnet USDC.
 */
export async function handleDepositAddress(ctx: ActionContext): Promise<ActionResult> {
  const wallet = await ensureWalletForUser(ctx.user.id);
  log.info("deposit address requested", { userId: ctx.user.id });

  const pk = wallet.stellarPublicKey;
  if (isTestnet) {
    return {
      reply:
        `Tu dirección en Stellar 👇\n${pk}\n\n` +
        `Manda tu USDC a esa dirección y dime "ahorra <monto>" para que empiece a rendir 🌱.`,
    };
  }

  return {
    reply:
      `Tu dirección de depósito en Stellar 👇\n${pk}\n\n` +
      `1) Manda ~2 XLM (activa la cuenta y paga las comisiones).\n` +
      `2) Escribe "activar" para habilitar USDC.\n` +
      `3) Manda tu USDC a esa misma dirección.\n` +
      `4) Dime "ahorra <monto>" para que empiece a rendir 🌱.`,
  };
}
