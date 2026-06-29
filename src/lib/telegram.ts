import { timingSafeEqual } from "node:crypto";
import { log } from "@/lib/log";

/** Whether Telegram webhook secret verification is configured. */
export function isTelegramSecretConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_WEBHOOK_SECRET);
}

/**
 * Verify Telegram's `X-Telegram-Bot-Api-Secret-Token` header against the secret
 * registered with setWebhook. Constant-time compare. Returns false on mismatch,
 * missing header, or missing secret.
 */
export function verifyTelegramSecret(header: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!header) return false;

  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(header, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * Send a plain-text message to a Telegram chat. No-ops (logged) when
 * TELEGRAM_BOT_TOKEN is unset, so local dev runs in mock mode.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    log.warn("Telegram send skipped (no token) — mock", { chatId, text });
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    log.error("Telegram send failed", { status: res.status, errorText });
  }
}
