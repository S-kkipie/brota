import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, messages } from "@/db/schema";
import { classifyIntent } from "@/lib/gemini";
import { dispatch } from "@/lib/actions/dispatch";
import { log } from "@/lib/log";
import {
  sendWhatsAppMessage,
  verifyMetaSignature,
  isMetaSignatureConfigured,
} from "@/lib/whatsapp";
import { createWalletForUser } from "@/lib/wallet";

export const runtime = "nodejs";

/**
 * Handle Meta Webhook Verification (GET).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    log.info("Webhook verified successfully!");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

/**
 * Meta WhatsApp Cloud API inbound webhook.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Read the RAW body once — needed verbatim for HMAC signature verification.
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    if (isMetaSignatureConfigured()) {
      if (!verifyMetaSignature(rawBody, signature)) {
        log.warn("rejected webhook: invalid X-Hub-Signature-256");
        return new Response("Forbidden", { status: 403 });
      }
    } else {
      // No app secret configured (local dev). Accept but make the gap loud.
      log.warn("WHATSAPP_APP_SECRET unset — skipping signature check (dev only)");
    }

    const body = JSON.parse(rawBody);

    // Check if it's a WhatsApp status update or actual message
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messagesArray = value?.messages;

    if (!messagesArray || messagesArray.length === 0) {
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    const message = messagesArray[0];
    const from = message.from;
    const textBody = message.text?.body?.trim();

    if (!from || !textBody) {
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    log.info("inbound", { from, textBody });

    // Find-or-create the user keyed by WhatsApp number.
    let user = await db.query.users.findFirst({
      where: eq(users.whatsappNumber, from),
    });
    
    if (!user) {
      const inserted = await db.insert(users).values({ 
        id: "usr_" + Date.now().toString(),
        whatsappNumber: from,
        createdAt: new Date()
      }).returning();
      user = inserted[0];
      log.info("new user", { userId: user.id });
      // Custodial-with-limits wallet on first contact (encrypted seed at rest).
      await createWalletForUser(user.id);
    }

    await db.insert(messages).values({ 
      id: "msg_" + Date.now().toString(),
      userId: user.id, 
      direction: "in", 
      body: textBody,
      createdAt: new Date()
    });

    const intent = await classifyIntent(textBody);
    const result = await dispatch({ user, intent });

    await db.insert(messages).values({
      id: "msg_" + Date.now().toString() + "_out",
      userId: user.id,
      direction: "out",
      body: result.reply,
      intent: intent.intent,
      createdAt: new Date()
    });

    // Send reply via Meta API
    await sendWhatsAppMessage(from, result.reply);

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    log.error("webhook failed", { err: String(err) });
    return new Response("Internal Server Error", { status: 500 });
  }
}
