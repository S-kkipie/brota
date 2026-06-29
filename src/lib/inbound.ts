import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, messages } from "@/db/schema";
import { classifyIntent } from "@/lib/gemini";
import { dispatch } from "@/lib/actions/dispatch";
import { continuePending } from "@/lib/conversation";
import { createWalletForUser } from "@/lib/wallet";
import { log } from "@/lib/log";

export type Channel = "whatsapp" | "telegram";

/**
 * Channel-agnostic conversational core. Finds or creates the user for the given
 * channel identity, logs the inbound message, advances any pending PIN flow or
 * classifies + dispatches intent, logs the reply, and returns it. The caller is
 * responsible for sending the reply over its own transport.
 */
export async function handleInboundMessage(params: {
  channel: Channel;
  externalId: string;
  text: string;
}): Promise<string> {
  const { channel, externalId, text } = params;

  // Find-or-create the user keyed by the channel's identity column.
  const whereUser =
    channel === "whatsapp"
      ? eq(users.whatsappNumber, externalId)
      : eq(users.telegramChatId, externalId);
  let user = await db.query.users.findFirst({ where: whereUser });

  if (!user) {
    const inserted = await db
      .insert(users)
      .values({
        id: "usr_" + Date.now().toString(),
        whatsappNumber: channel === "whatsapp" ? externalId : null,
        telegramChatId: channel === "telegram" ? externalId : null,
        createdAt: new Date(),
      })
      .returning();
    user = inserted[0];
    log.info("new user", { userId: user.id, channel });
    // Custodial-with-limits wallet on first contact (encrypted seed at rest).
    await createWalletForUser(user.id);
  }

  await db.insert(messages).values({
    id: "msg_" + Date.now().toString(),
    userId: user.id,
    direction: "in",
    body: text,
    createdAt: new Date(),
  });

  // Mid-flow (e.g. PIN entry) consumes this message as the awaited input;
  // otherwise classify intent and dispatch.
  const pendingResult = await continuePending(user, text);
  let reply: string;
  let intentName: string;
  if (pendingResult) {
    reply = pendingResult.reply;
    intentName = "pin_flow";
  } else {
    const intent = await classifyIntent(text);
    const result = await dispatch({ user, intent });
    reply = result.reply;
    intentName = intent.intent;
  }

  await db.insert(messages).values({
    id: "msg_" + Date.now().toString() + "_out",
    userId: user.id,
    direction: "out",
    body: reply,
    intent: intentName,
    createdAt: new Date(),
  });

  return reply;
}
