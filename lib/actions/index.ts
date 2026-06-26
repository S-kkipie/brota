import type { ActionContext, ActionResult } from "@/lib/actions/types";
import { handleDeposit } from "@/lib/actions/deposit";
import { handleBalance } from "@/lib/actions/balance";
import { handleCoach } from "@/lib/actions/coach";

/** Route a classified intent to its handler. */
export async function dispatch(ctx: ActionContext): Promise<ActionResult> {
  switch (ctx.intent.intent) {
    case "deposit":
      return handleDeposit(ctx);
    case "balance":
      return handleBalance(ctx);
    case "coach":
    case "unknown":
    default:
      return handleCoach(ctx);
  }
}

export type { ActionContext, ActionResult };
