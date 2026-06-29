# Add Telegram Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Telegram as a second live inbound channel alongside Meta WhatsApp, reusing one shared conversational core.

**Architecture:** Extract the channel-agnostic message logic (find/create user → log → PIN-flow or classify+dispatch → log → reply) out of the WhatsApp route into `src/lib/inbound.ts`. Add a Telegram transport (`src/lib/telegram.ts`) and a Telegram webhook (`src/app/api/telegram/route.ts`) that call the same core. Users are keyed by a per-channel identity column.

**Tech Stack:** Next.js App Router (route handlers), TypeScript, SQLite (libSQL) + Drizzle ORM, Telegram Bot API (`api.telegram.org/bot<token>/sendMessage`, webhook `secret_token`), Node `node:crypto`.

## Global Constraints

- **Never** use `any`; **never** `as unknown as` / double-casts. A single `as <Type>` on a `JSON.parse` result is allowed.
- **Never** create `index.ts` barrel files — name every module by what it does.
- All source under `src/`; `@/*` maps to `./src/*`.
- Business logic in `src/lib/`, not in route handlers.
- All logging via `@/lib/log` (`log`). No `console.log` in committed code.
- **AI never moves funds.** The PIN-authorization step (`continuePending`) gates every fund move and must stay reachable unchanged through the shared core.
- **Verify inbound webhooks.** Telegram secret check enforced whenever `TELEGRAM_WEBHOOK_SECRET` is set; loud warn when unset. WhatsApp HMAC check unchanged.
- **No secrets in repo.** New vars live in `.env` (gitignored) + Railway; `.env.example` lists keys only.
- Stellar **testnet only** — untouched here.
- This repo has **no test runner** (no vitest/jest). Per AGENTS.md, the hard gate per task is `pnpm typecheck` (and `pnpm build` for the final task). Runtime smoke tests use `curl` against `pnpm dev` and require `GEMINI_API_KEY` in `.env` (the core calls `classifyIntent`). Treat smoke tests as confirmation, typecheck as the gate.
- Package manager: **pnpm**. Node 24.

---

### Task 1: Schema — per-channel identity columns

**Files:**
- Modify: `src/db/schema.ts:14-20` (the `users` table)
- Generate: `src/db/migrations/*` (drizzle-kit output)

**Interfaces:**
- Consumes: nothing.
- Produces: `users.whatsappNumber` is now nullable; new nullable unique `users.telegramChatId` (column `telegram_chat_id`). `User` type gains `telegramChatId: string | null` and `whatsappNumber: string | null`.

- [ ] **Step 1: Make `whatsapp_number` nullable and add `telegram_chat_id`**

In `src/db/schema.ts`, replace the `whatsappNumber` line inside `users`:

```ts
  whatsappNumber: text("whatsapp_number").notNull().unique(),
```

with these two lines (note: `.notNull()` dropped, new column added):

```ts
  whatsappNumber: text("whatsapp_number").unique(),
  telegramChatId: text("telegram_chat_id").unique(),
```

The full `users` table should read:

```ts
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  whatsappNumber: text("whatsapp_number").unique(),
  telegramChatId: text("telegram_chat_id").unique(),
  displayName: text("display_name"),
  /** Hash of the user's PIN (never the PIN itself). Authorizes fund moves. */
  pinHash: text("pin_hash"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

Also update the doc comment above the table from "A person identified by their WhatsApp number" to "A person identified by their WhatsApp number or Telegram chat id".

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file under `src/db/migrations/` (e.g. `0002_*.sql`) recreating `users` with the nullable `whatsapp_number` and the new `telegram_chat_id` column. The journal/meta snapshot files update.

- [ ] **Step 3: Push the schema to the local DB**

Run: `pnpm db:push`
Expected: applies cleanly. If drizzle-kit prompts about the `whatsapp_number` NOT-NULL change, accept — the local DB is disposable (gitignored) and existing rows all have `whatsapp_number` set, so no NULL conflict.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no type errors). `User` now exposes `telegramChatId`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations
git commit -m "feat(schema): per-channel identity (nullable whatsapp_number + telegram_chat_id)"
```

---

### Task 2: Shared conversational core + rewire WhatsApp route

Bundled because the core is dead code until a caller uses it, and rewiring the existing WhatsApp route both proves the core correct (through the already-working channel) and keeps a single source of truth. A reviewer evaluates them together: "WhatsApp still works, now through the shared core."

**Files:**
- Create: `src/lib/inbound.ts`
- Modify: `src/app/api/whatsapp/route.ts` (POST handler body + imports; GET unchanged)

**Interfaces:**
- Consumes: `User` (Task 1); `db`, `users`, `messages` (`@/db/schema`); `classifyIntent` (`@/lib/gemini`); `dispatch` (`@/lib/actions/dispatch`); `continuePending` (`@/lib/conversation`); `createWalletForUser` (`@/lib/wallet`); `log` (`@/lib/log`).
- Produces: `export type Channel = "whatsapp" | "telegram"` and `export async function handleInboundMessage(params: { channel: Channel; externalId: string; text: string }): Promise<string>` — returns the reply text. Used by Tasks 4 and (here) the WhatsApp route.

- [ ] **Step 1: Create the shared core**

Create `src/lib/inbound.ts`:

```ts
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
```

- [ ] **Step 2: Rewire the WhatsApp POST handler to use the core**

In `src/app/api/whatsapp/route.ts`, replace the import block at the top. Remove the now-unused imports (`eq`, `db`, `users`, `messages`, `classifyIntent`, `dispatch`, `createWalletForUser`, `continuePending`) and add `handleInboundMessage`. The imports should become exactly:

```ts
import { log } from "@/lib/log";
import {
  sendWhatsAppMessage,
  verifyMetaSignature,
  isMetaSignatureConfigured,
} from "@/lib/whatsapp";
import { handleInboundMessage } from "@/lib/inbound";

export const runtime = "nodejs";
```

Leave the `GET` handler (Meta subscription verify) exactly as-is.

Replace the entire `POST` function body — from the inbound user/message handling down — so the handler keeps only transport concerns. The full `POST` should read:

```ts
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
```

(`const body = JSON.parse(rawBody)` keeps the existing route's style; do not change it.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. No unused-import errors (eslint may flag unused imports — if `pnpm lint` is run, ensure none remain in the route).

- [ ] **Step 4: Smoke test WhatsApp still works through the core (requires `GEMINI_API_KEY` in `.env`)**

In one terminal: `pnpm dev`. In another:

```bash
curl -s -X POST http://localhost:3000/api/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"51999000111","text":{"body":"hola"}}]}}]}]}'
```

Expected: HTTP body `EVENT_RECEIVED`. Dev logs show `new user … channel: "whatsapp"`, an `inbound` line, and a mock send (`WhatsApp send skipped (no creds)`) if no WhatsApp token is set. A `users` row exists with `whatsapp_number = 51999000111` and `telegram_chat_id = NULL`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inbound.ts src/app/api/whatsapp/route.ts
git commit -m "refactor(inbound): extract channel-agnostic core; WhatsApp route delegates to it"
```

---

### Task 3: Telegram transport library

**Files:**
- Create: `src/lib/telegram.ts`

**Interfaces:**
- Consumes: `log` (`@/lib/log`); `node:crypto` `timingSafeEqual`; env `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.
- Produces:
  - `export function isTelegramSecretConfigured(): boolean`
  - `export function verifyTelegramSecret(header: string | null): boolean`
  - `export async function sendTelegramMessage(chatId: string, text: string): Promise<void>`
  Used by Task 4.

- [ ] **Step 1: Create the transport**

Create `src/lib/telegram.ts`:

```ts
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
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram.ts
git commit -m "feat(telegram): transport lib (send + secret-token verification)"
```

---

### Task 4: Telegram inbound webhook

**Files:**
- Create: `src/app/api/telegram/route.ts`

**Interfaces:**
- Consumes: `handleInboundMessage`, `Channel` semantics (Task 2); `sendTelegramMessage`, `verifyTelegramSecret`, `isTelegramSecretConfigured` (Task 3); `log`.
- Produces: a `POST` route handler at `/api/telegram`. (No `GET` — Telegram has no verification handshake.)

- [ ] **Step 1: Create the webhook route**

Create `src/app/api/telegram/route.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. `chatId` is `number | undefined`; the `String(chatId)` call is only reached after the null/undefined guard.

- [ ] **Step 3: Smoke test the Telegram channel (requires `GEMINI_API_KEY` in `.env`)**

With `pnpm dev` running:

```bash
curl -s -X POST http://localhost:3000/api/telegram \
  -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"id":555000111},"text":"hola"}}'
```

Expected: HTTP body `OK`. Dev logs show `new user … channel: "telegram"`, an `inbound` line, and `Telegram send skipped (no token) — mock`. A `users` row exists with `telegram_chat_id = 555000111` and `whatsapp_number = NULL`.

- [ ] **Step 4: Verify the secret check rejects when configured (no Gemini needed)**

Stop dev, restart with a secret: `TELEGRAM_WEBHOOK_SECRET=testsecret pnpm dev`. Then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/telegram \
  -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"id":555000222},"text":"hola"}}'
```

Expected: `403` (no/invalid secret header). Adding `-H "X-Telegram-Bot-Api-Secret-Token: testsecret"` should instead reach the core (200).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/telegram/route.ts
git commit -m "feat(telegram): inbound webhook delegating to shared core"
```

---

### Task 5: Demo display, env, and docs

**Files:**
- Modify: `src/app/demo/page.tsx:100`
- Modify: `.env.example`
- Modify: `AGENTS.md` (stack + security sections)

**Interfaces:**
- Consumes: `user.whatsappNumber`, `user.telegramChatId` (Task 1).
- Produces: nothing code-facing.

- [ ] **Step 1: Demo page shows Telegram-only users**

In `src/app/demo/page.tsx` line 100, replace:

```tsx
                      <h2 className="text-2xl font-bold">{user.whatsappNumber}</h2>
```

with:

```tsx
                      <h2 className="text-2xl font-bold">{user.whatsappNumber ?? user.telegramChatId ?? "—"}</h2>
```

- [ ] **Step 2: Add Telegram vars to `.env.example`**

In `.env.example`, immediately after the `WHATSAPP_APP_SECRET=` line (end of the WhatsApp block), add:

```
# --- Telegram Bot API ---
# Bot token from BotFather. Webhook secret is your own random string, set at
# registration and echoed back in X-Telegram-Bot-Api-Secret-Token — set it in
# prod or the endpoint runs unauthenticated. Register the webhook once:
#   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
#     -d "url=https://<host>/api/telegram" \
#     -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

- [ ] **Step 3: Document Telegram in AGENTS.md stack section**

In `AGENTS.md`, in the "Stack (locked …)" list, immediately after the "Meta WhatsApp Cloud API" bullet, add:

```
- **Telegram Bot API** — second inbound channel alongside WhatsApp. Webhook at
  `src/app/api/telegram/route.ts` (POST only; no GET handshake). Send via
  `src/lib/telegram.ts`. Both channels share `src/lib/inbound.ts` (the
  channel-agnostic core: user lookup, PIN flow, intent dispatch).
```

- [ ] **Step 4: Document Telegram secrets in AGENTS.md security section**

In `AGENTS.md`, in the "No secrets in the repo" bullet, add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` to the listed env vars. Then, after the "Verify inbound webhooks" bullet (the WhatsApp HMAC one), add:

```
- **Telegram webhooks** use Telegram's `secret_token`: the value passed to
  `setWebhook` is echoed in `X-Telegram-Bot-Api-Secret-Token` and compared
  constant-time to `TELEGRAM_WEBHOOK_SECRET`. Enforced whenever the secret is set;
  set it in every non-local deploy or the endpoint accepts unauthenticated POSTs.
```

- [ ] **Step 5: Full build (the per-task gate plus production build)**

Run: `pnpm build`
Expected: PASS. Both `/api/whatsapp` and `/api/telegram` appear as routes in the build output.

- [ ] **Step 6: Commit**

```bash
git add src/app/demo/page.tsx .env.example AGENTS.md
git commit -m "docs(telegram): demo display fallback, env.example, AGENTS.md"
```

---

## Manual post-deploy step (not a code task)

After deploying with `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` set on Railway, register the webhook once:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://<railway-host>/api/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Expected response: `{"ok":true,"result":true,"description":"Webhook was set"}`. Verify with `getWebhookInfo`.

---

## Self-Review

**Spec coverage:**
- Keep both channels → Tasks 2–4 add Telegram without removing WhatsApp. ✓
- Telegram via webhook → Task 4 (POST route). ✓
- Add nullable `telegram_chat_id`, nullable `whatsapp_number` → Task 1. ✓
- Shared `inbound.ts` core → Task 2. ✓
- `telegram.ts` send + secret verify + configured → Task 3. ✓
- Telegram route POST-only, ignore non-text/non-message, no GET → Task 4. ✓
- WhatsApp route refactor to delegate → Task 2 Step 2. ✓
- Demo page fallback to telegramChatId → Task 5 Step 1. ✓
- New env vars + `.env.example` keys-only + setWebhook doc → Task 5 Steps 2–4 + post-deploy. ✓
- AGENTS.md stack + security updates → Task 5 Steps 3–4. ✓
- Security: PIN flow reachable unchanged (Task 2 routes through `continuePending`); secret check enforced when set (Task 4 Step 4 verifies 403). ✓
- `messages` channel column out of scope → not added. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. `<host>` / `<railway-host>` are intentional deploy-host placeholders in documented curl commands, not plan gaps.

**Type consistency:** `handleInboundMessage({ channel, externalId, text }) => Promise<string>` is defined in Task 2 and called identically in Task 2 (WhatsApp) and Task 4 (Telegram). `Channel = "whatsapp" | "telegram"` used consistently. `verifyTelegramSecret(header: string | null)`, `isTelegramSecretConfigured()`, `sendTelegramMessage(chatId: string, text: string)` defined in Task 3, called with matching signatures in Task 4. `telegramChatId` / `telegram_chat_id` naming consistent across schema, core, and demo page.
