import { getWalletForUser } from "@/lib/wallet";
import { getVaultPosition } from "@/lib/defindex";
import { optionalEnv } from "@/lib/env";
import { log } from "@/lib/log";
import type { ActionContext, ActionResult } from "@/lib/actions/types";

/**
 * Balance flow. Reads the user's live DeFindex vault position. No PIN — reading
 * a balance moves no funds.
 */
export async function handleBalance(ctx: ActionContext): Promise<ActionResult> {
  log.info("balance requested", { userId: ctx.user.id });

  const wallet = await getWalletForUser(ctx.user.id);
  if (!wallet) {
    return { reply: 'Aún no tienes ahorros. Escribe "ahorra 50" para empezar 🌱.' };
  }

  const vaultId = optionalEnv("DEFINDEX_VAULT_ID");
  if (!vaultId) {
    return { reply: "Tu cuenta de ahorro aún se está configurando. Inténtalo en un rato." };
  }

  const { shares, valueUsdc } = await getVaultPosition(wallet.stellarPublicKey, vaultId);
  if (valueUsdc <= 0 && shares <= 0) {
    return { reply: 'Todavía no tienes saldo en tu ahorro. Escribe "ahorra 50" para empezar.' };
  }

  return {
    reply:
      `Tu ahorro vale ${valueUsdc.toFixed(2)} USDC 🌱 ` +
      `y sigue creciendo con el rendimiento del vault. ¡Bien hecho!`,
  };
}
