import { log } from "@/lib/log";
import {
  sendTelegramMessage,
  verifyTelegramSecret,
  isTelegramSecretConfigured,
} from "@/lib/telegram";
import { handleInboundMessage } from "@/lib/inbound";

export const runtime = "nodejs";

/** Minimal shape of the Telegram update fields we consume. */
interface TelegramUpdate {
  message?: {
    chat?: { id?: number };
    text?: string;
  };
}

/**
 * Telegram Bot API inbound webhook (POST only). Telegram has no GET handshake;
 * the webhook is registered out of band via setWebhook with a `secret_token`,
 * which Telegram echoes in the `X-Telegram-Bot-Api-Secret-Token` header.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text();

    if (isTelegramSecretConfigured()) {
      const header = req.headers.get("x-telegram-bot-api-secret-token");
      if (!verifyTelegramSecret(header)) {
        log.warn("rejected webhook: invalid Telegram secret token");
        return new Response("Forbidden", { status: 403 });
      }
    } else {
      // No secret configured (local dev). Accept but make the gap loud.
      log.warn("TELEGRAM_WEBHOOK_SECRET unset — skipping secret check (dev only)");
    }

    const update = JSON.parse(rawBody) as TelegramUpdate;
    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim();

    if (chatId === undefined || chatId === null || !text) {
      // Status update, edited message, non-text, etc. — nothing to do.
      return new Response("OK", { status: 200 });
    }

    const externalId = String(chatId);
    log.info("inbound", { from: externalId, text, channel: "telegram" });
    const reply = await handleInboundMessage({
      channel: "telegram",
      externalId,
      text,
    });
    await sendTelegramMessage(externalId, reply);

    return new Response("OK", { status: 200 });
  } catch (err) {
    log.error("telegram webhook failed", { err: String(err) });
    return new Response("Internal Server Error", { status: 500 });
  }
}
