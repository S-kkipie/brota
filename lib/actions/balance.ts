import { logger } from "@/lib/log";
import type { ActionContext, ActionResult } from "@/lib/actions/types";

const log = logger("action", "balance");

/**
 * Balance flow. MVP: read the cached position snapshot (refreshed from the
 * DeFindex vault) and report savings + yield.
 *
 * STATUS: stub until DeFindex readPosition is verified (D1) and positions are
 * persisted (D3).
 */
export async function handleBalance(ctx: ActionContext): Promise<ActionResult> {
  log.info("balance requested", { userId: ctx.user.id });

  // TODO(D3): read positions snapshot for ctx.user and format yield.
  return {
    reply: "Tu resumen de ahorro y rendimiento estará aquí muy pronto 🚧.",
  };
}
