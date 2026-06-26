import type { Intent } from "@/lib/gemini";
import type { User } from "@/db/schema";

/** Result an action returns to the webhook, which replies over WhatsApp. */
export interface ActionResult {
  /** Message text to send back to the user (Spanish). */
  reply: string;
}

export interface ActionContext {
  user: User;
  intent: Intent;
}
