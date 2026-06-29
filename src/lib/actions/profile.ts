import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { APP_BASE_URL } from "@/lib/env";
import { log } from "@/lib/log";
import type { ActionContext, ActionResult } from "@/lib/actions/types";

/**
 * Profile-link flow. Mints a stable, unguessable web token for the user (once)
 * and returns the URL to their read-only web profile. Moves no funds.
 */
export async function handleProfile(ctx: ActionContext): Promise<ActionResult> {
  log.info("profile requested", { userId: ctx.user.id });

  let token = ctx.user.webToken;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await db.update(users).set({ webToken: token }).where(eq(users.id, ctx.user.id));
    log.info("web token minted", { userId: ctx.user.id });
  }

  const link = `${APP_BASE_URL}/u/${token}`;
  return {
    reply: `Aquí puedes ver cómo crece tu ahorro 🌱:\n${link}`,
  };
}
