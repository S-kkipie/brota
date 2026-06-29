import { log } from "@/lib/log";
import {
  sendWhatsAppMessage,
  verifyMetaSignature,
  isMetaSignatureConfigured,
} from "@/lib/whatsapp";
import { handleInboundMessage } from "@/lib/inbound";

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
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;
    const textBody = message?.text?.body?.trim();

    if (!from || !textBody) {
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    log.info("inbound", { from, textBody, channel: "whatsapp" });
    const reply = await handleInboundMessage({
      channel: "whatsapp",
      externalId: from,
      text: textBody,
    });
    await sendWhatsAppMessage(from, reply);

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    log.error("webhook failed", { err: String(err) });
    return new Response("Internal Server Error", { status: 500 });
  }
}
