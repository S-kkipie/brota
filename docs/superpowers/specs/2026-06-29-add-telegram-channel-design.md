# Add Telegram channel alongside WhatsApp

**Date:** 2026-06-29
**Status:** Approved design, ready for implementation plan
**Context:** Brota — dollar savings over chat for Peru, on Stellar. Currently the only
inbound channel is the Meta WhatsApp Cloud API. This adds Telegram as a second live
channel without removing WhatsApp.

## Goal

Let a user talk to Brota over **either** WhatsApp **or** Telegram. Both channels stay
live. The conversational core (NLU, coach, PIN flow, deposit, balance, custodial wallet)
is identical regardless of channel — only the transport differs.

## Decisions (locked)

1. **Keep both channels.** WhatsApp stays; Telegram is added alongside. Not a replacement.
2. **Telegram via webhook** (not long-polling). Mirrors the existing WhatsApp webhook and
   fits the Railway persistent-Node deploy. Needs a public URL + a one-time `setWebhook`
   registration.
3. **Identity:** add a nullable, unique `telegram_chat_id` column to `users`; make
   `whatsapp_number` nullable. Each webhook looks up its own column. A user row belongs to
   whichever channel created it.

## Key insight

The current WhatsApp POST handler's core is already channel-agnostic:

```
find-or-create user  →  log inbound  →  continuePending OR classifyIntent+dispatch
                     →  log outbound  →  return reply
```

Only the transport (signature scheme, parse shape, send call, identity column) is
WhatsApp-specific. So extract the core once and have both routes reuse it, rather than
duplicating ~50 lines per channel.

## Architecture

### New: `src/lib/inbound.ts` — shared conversational core

```ts
export type Channel = "whatsapp" | "telegram";

export async function handleInboundMessage(params: {
  channel: Channel;
  externalId: string; // WhatsApp number, or Telegram chat id (as string)
  text: string;
}): Promise<string>; // returns the reply text to send back over the same channel
```

Responsibilities (moved verbatim out of the WhatsApp route):

- Find-or-create the `User`, keyed by the channel's identity column
  (`whatsapp_number` for `whatsapp`, `telegram_chat_id` for `telegram`).
- On first contact, create the custodial-with-limits wallet (`createWalletForUser`).
  This is channel-agnostic and stays in the core.
- Insert the inbound `messages` row.
- If a `pendingActions` flow is open, call `continuePending(user, text)`; otherwise
  `classifyIntent(text)` then `dispatch({ user, intent })`.
- Insert the outbound `messages` row (with `intent`).
- Return the reply string. The caller is responsible for sending it over its transport.

The core does **not** know about HTTP, signatures, or Telegram/WhatsApp payload shapes.

### New: `src/lib/telegram.ts` — Telegram transport

Mirrors `src/lib/whatsapp.ts`:

- `sendTelegramMessage(chatId: string, text: string)` — POST to
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` with body
  `{ chat_id, text }`. When `TELEGRAM_BOT_TOKEN` is unset, log a warn and no-op (mock
  mode), same as the WhatsApp send.
- `isTelegramSecretConfigured(): boolean` — whether `TELEGRAM_WEBHOOK_SECRET` is set.
- `verifyTelegramSecret(header: string | null): boolean` — constant-time compare of the
  inbound `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`.

### New: `src/app/api/telegram/route.ts` — Telegram inbound webhook

`POST` only (Telegram has no GET verification handshake; the webhook is registered out of
band via `setWebhook`).

1. `runtime = "nodejs"`.
2. Read the raw body. If `isTelegramSecretConfigured()`, require
   `verifyTelegramSecret(req.headers.get("x-telegram-bot-api-secret-token"))`; on failure
   return `403`. If unset, log a loud dev-only warn and accept (same posture as the Meta
   handler with no app secret).
3. Parse the update. Extract `update.message?.chat?.id` and `update.message?.text?.trim()`.
   If either is missing (status update, edited message, non-text, etc.), return `200` with
   no action.
4. `const reply = await handleInboundMessage({ channel: "telegram", externalId: String(chatId), text })`.
5. `await sendTelegramMessage(String(chatId), reply)`.
6. Return `200`.

Telegram expects a `2xx` quickly or it retries; keep the handler's happy path fast and
return `200` on ignored updates.

### Refactor: `src/app/api/whatsapp/route.ts`

- `GET` (Meta subscription verify) — unchanged.
- `POST` — keep the raw-body read + `X-Hub-Signature-256` verification + payload parse.
  Replace the inline find/create/log/dispatch/log block with:
  ```ts
  const reply = await handleInboundMessage({ channel: "whatsapp", externalId: from, text: textBody });
  await sendWhatsAppMessage(from, reply);
  ```
  Net result: the route shrinks to transport concerns only.

## Data model

`src/db/schema.ts`, `users` table:

```ts
whatsappNumber: text("whatsapp_number").unique(),          // was .notNull().unique()
telegramChatId: text("telegram_chat_id").unique(),         // new, nullable
```

Both nullable + unique. A user has exactly one of them set (the channel that created it).

Migration: `pnpm db:generate && pnpm db:push`. The DB file is gitignored and disposable in
this MVP, so there is no production data to preserve. SQLite rebuilds the table for the
NOT NULL drop; drizzle-kit handles it.

`src/app/demo/page.tsx:100` currently renders `user.whatsappNumber`. Change to
`user.whatsappNumber ?? user.telegramChatId ?? "—"` so a Telegram-only user displays.

The `messages` table is left as-is (no channel column). Channel is implied by the user's
identity column; adding a channel field to messages is out of scope (YAGNI for the demo).

## Security

Unchanged guarantees:

- **AI never moves funds.** Telegram reaches the exact same `continuePending` / `dispatch`
  path, so the PIN-authorization step still gates every fund movement.
- **Custodial-with-limits wallet** creation is in the shared core, identical per channel.
- **Webhook authenticity:** WhatsApp keeps HMAC `X-Hub-Signature-256`. Telegram uses its
  native `secret_token` mechanism — Telegram echoes the secret set at registration in the
  `X-Telegram-Bot-Api-Secret-Token` header, compared constant-time to
  `TELEGRAM_WEBHOOK_SECRET`. Enforced whenever the secret is set; a loud warn when unset so
  the gap is never silent. Set it in every non-local deploy.
- **No secrets in the repo.** `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` live in
  `.env` (gitignored) and Railway only; `.env.example` lists the keys with no values.
- **Testnet only** for Stellar — untouched.

## Webhook registration (one-time, documented)

After deploy, register the webhook with Telegram (curl documented in AGENTS.md and as a
comment in `.env.example`):

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://<host>/api/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

The bot token comes from BotFather; the secret is any random string the deploy generates.

## New environment variables

| Var | Source | Purpose |
|-----|--------|---------|
| `TELEGRAM_BOT_TOKEN` | BotFather | Auth for sending + the `setWebhook` call |
| `TELEGRAM_WEBHOOK_SECRET` | random | Set at `setWebhook`; verified on every inbound POST |

Add both to `.env.example` (keys only) and to AGENTS.md's stack + security sections, listed
next to the existing WhatsApp vars.

## Out of scope

- Removing WhatsApp.
- Long-polling / `getUpdates`.
- Telegram-specific UI (inline keyboards, buttons) — plain text replies only, matching the
  current WhatsApp experience.
- A channel column on `messages`.
- Migrating existing WhatsApp users to a generic identity model.

## Files touched

| File | Change |
|------|--------|
| `src/lib/inbound.ts` | New — shared conversational core |
| `src/lib/telegram.ts` | New — send + secret verification |
| `src/app/api/telegram/route.ts` | New — Telegram inbound webhook (POST) |
| `src/app/api/whatsapp/route.ts` | Refactor — delegate core to `handleInboundMessage` |
| `src/db/schema.ts` | `whatsapp_number` nullable; add `telegram_chat_id` |
| `src/db/migrations/*` | Generated migration |
| `src/app/demo/page.tsx` | Display fallback to `telegramChatId` |
| `.env.example` | Add the two Telegram vars + registration comment |
| `AGENTS.md` | Document Telegram in stack + security sections |

## Verification

`pnpm build` (or `pnpm typecheck`) must pass before claiming done — per AGENTS.md.
