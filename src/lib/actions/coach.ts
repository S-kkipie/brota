import type { ActionContext, ActionResult } from "@/lib/actions/types";

/**
 * Coach / fallback flow. Gemini already drafted the educational reply during
 * intent classification, so we just relay it.
 */
export async function handleCoach(ctx: ActionContext): Promise<ActionResult> {
  return { reply: ctx.intent.reply };
}
