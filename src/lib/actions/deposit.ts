import { logger } from "@/lib/log";
import type { ActionContext, ActionResult } from "@/lib/actions/types";

const log = logger("action", "deposit");

/**
 * Deposit flow (custodial-with-limits). MVP shape:
 *   1. confirm amount with the user
 *   2. require PIN authorization (the AI never moves funds on its own)
 *   3. DeFindex deposit -> log tx -> update position snapshot
 *
 * STATUS: stub until DeFindex is verified (D1) and PIN auth is wired (D3).
 */
export async function handleDeposit(ctx: ActionContext): Promise<ActionResult> {
  const { intent } = ctx;
  log.info("deposit requested", { amountUsdc: intent.amountUsdc });

  if (!intent.amountUsdc) {
    return { reply: "¿Cuánto te gustaría ahorrar? Dime un monto, por ejemplo: \"ahorra 50\"." };
  }

  // TODO(D3): PIN auth -> defindex.deposit -> persist transaction + position.
  return {
    reply:
      `Listo, prepararé tu ahorro de ${intent.amountUsdc} USDC. ` +
      `Para confirmarlo te pediré tu PIN (aún en construcción 🚧).`,
  };
}
