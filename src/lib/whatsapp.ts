import { createHmac, timingSafeEqual } from "node:crypto";
import { log } from "@/lib/log";

/** Whether webhook signature verification is configured (app secret present). */
export function isMetaSignatureConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_APP_SECRET);
}

/**
 * Verify Meta's `X-Hub-Signature-256` over the EXACT raw request body using the
 * app secret (HMAC-SHA256). The body must be the raw bytes Meta sent — never a
 * re-serialized JSON, whose byte layout would differ and fail the check.
 * Returns false on any mismatch, malformed header, or missing secret.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  const computed = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest();

  if (expected.length === 0 || expected.length !== computed.length) return false;
  return timingSafeEqual(expected, computed);
}

export async function sendWhatsAppMessage(to: string, message: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    log.warn("WhatsApp send skipped (no creds) — mock", { to, message });
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to, // Format: e.g. "51999999999" (without '+')
    type: "text",
    text: { body: message }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    log.error("WhatsApp send failed", { status: res.status, errorText });
  }
}
