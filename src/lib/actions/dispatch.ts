import type { ActionContext, ActionResult } from "@/lib/actions/types";
import { handleDeposit } from "@/lib/actions/deposit";
import { handleWithdraw } from "@/lib/actions/withdraw";
import { handleBalance } from "@/lib/actions/balance";
import { handleCoach } from "@/lib/actions/coach";
import { handleProfile } from "@/lib/actions/profile";

/** Route a classified intent to its handler. */
export async function dispatch(ctx: ActionContext): Promise<ActionResult> {
  switch (ctx.intent.intent) {
    case "deposit":
      return handleDeposit(ctx);
    case "withdraw":
      return handleWithdraw(ctx);
    case "balance":
      return handleBalance(ctx);
    case "profile":
      return handleProfile(ctx);
    case "coach":
    case "unknown":
    default:
      return handleCoach(ctx);
  }
}

export type { ActionContext, ActionResult };
