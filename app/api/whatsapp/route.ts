import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, messages } from "@/db/schema";
import { classifyIntent } from "@/lib/gemini";
import { dispatch } from "@/lib/actions";
import { logger } from "@/lib/log";

const log = logger("whatsapp");

// Webhook hits an external Stellar/Gemini path — keep it on the Node runtime,
// never edge/serverless-edge.
export const runtime = "nodejs";

/** Minimal XML escaping for TwiML message bodies. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(message: string): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(
    message,
  )}</Message></Response>`;
  return new Response(body, { headers: { "Content-Type": "text/xml" } });
}

/**
 * Twilio WhatsApp inbound webhook.
 *
 * TODO(D2) SECURITY: validate the `X-Twilio-Signature` header with
 * twilio.validateRequest before trusting any field. Do not ship to the demo
 * without it — right now this endpoint accepts unauthenticated POSTs.
 */
export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const from = String(form.get("From") ?? "");
  const body = String(form.get("Body") ?? "").trim();

  if (!from || !body) {
    return twiml("No recibí tu mensaje. ¿Puedes intentarlo de nuevo?");
  }

  log.info("inbound", { from, body });

  try {
    // Find-or-create the user keyed by WhatsApp number.
    let user = await db.query.users.findFirst({
      where: eq(users.whatsappNumber, from),
    });
    if (!user) {
      [user] = await db.insert(users).values({ whatsappNumber: from }).returning();
      log.info("new user", { userId: user.id });
    }

    await db.insert(messages).values({ userId: user.id, direction: "in", body });

    const intent = await classifyIntent(body);
    const result = await dispatch({ user, intent });

    await db.insert(messages).values({
      userId: user.id,
      direction: "out",
      body: result.reply,
      intent: intent.intent,
    });

    return twiml(result.reply);
  } catch (err) {
    log.error("webhook failed", { err: String(err) });
    return twiml("Tuvimos un problema procesando tu mensaje. Inténtalo en un momento 🙏.");
  }
}
