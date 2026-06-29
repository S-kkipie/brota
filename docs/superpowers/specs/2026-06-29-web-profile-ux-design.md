# Brota — Web Profile UX Design

**Date:** 2026-06-29
**Status:** Approved (brainstorming)
**Goal:** Each user views their own savings (balance + yield), savings-growth chart, transaction
history, and profile data on the web, reached via a magic link the bot sends — no web login.

## Context

Today the web is two pages:

- `/` — marketing landing (hero + 3 feature cards). CTA "Ver Demo Dashboard" → `/demo`.
- `/demo` — a **global admin/god view**: an RSC that reads the DB and renders aggregate stats
  plus a per-user card (balance, growth chart, recent movements) for **every** user at once.

We want a **per-user** experience instead: a personal profile each user can open from the bot.
The schema states "No web login in MVP" — users are identified only by WhatsApp number or
Telegram chat id. So personal access cannot use passwords/sessions.

## Decisions (locked during brainstorming)

1. **Access:** magic link from the bot → `/u/<token>`. The token identifies the user; no login.
2. **Sections on the profile:** balance + yield, savings-growth chart, transaction list,
   profile data — all four.
3. **Link delivery:** a new bot intent (`profile`). The user asks ("mi perfil", "web", "ver mis
   ahorros") and the bot replies with the link. Not auto-pushed.
4. **`/demo` fate:** **replaced**. The global god-view is removed. `/demo` is repurposed to show a
   single **showcase** profile (for judges), reusing the same profile components.
5. **Token model:** a persistent, unguessable `web_token` column on `users` (chosen over signed
   HMAC tokens and over raw `user.id` in the URL). Rejected alternatives:
   - Signed HMAC token (no DB column, links expire): overkill for a read-only testnet demo;
     adds a signing-secret env and "link expired" UX.
   - Raw `user.id` in URL: ids are `usr_<timestamp>`, enumerable — anyone could browse other
     users' balances. Unacceptable.

## Architecture

One new RSC route reads the DB directly (no client data layer — same pattern as the current
`/demo`). The bot gains one intent that mints/returns the link. Nothing on the web moves funds
or exposes keys; the web is strictly read-only.

```
bot ("mi perfil") ──▶ classifyIntent → "profile" ──▶ handleProfile
                                                         │ ensure users.web_token
                                                         ▼
                                          reply: "{APP_BASE_URL}/u/<token>"

browser GET /u/<token> ──▶ RSC: lookup user by web_token ──▶ <ProfileView> (4 sections)
browser GET /demo      ──▶ RSC: resolve showcase user   ──▶ <ProfileView> (same component)
```

## Components & Files

### Data model — `src/db/schema.ts` (+ Drizzle migration)

Add to `users`:

```ts
webToken: text("web_token").unique(),   // nullable; minted on demand by handleProfile
```

Nullable so existing rows are valid; the bot action backfills lazily on first request.

### Shared helpers — `src/lib/savings.ts` (new, pure functions)

Extract the helpers currently inlined in `src/app/demo/page.tsx` so both routes and the
components share them (DRY, unit-testable):

- `fmtUsdc(n: number): string`
- `fmtDate(d: Date): string`
- `round2(n: number): number`
- `isRealTx(hash: string | null): boolean` — true when hash is set and not `mock_…`
- `netDeposited(txs: Transaction[]): number` — deposits minus withdrawals
- `buildSeries(txsAsc: Transaction[], currentValue: number | null): YieldPoint[]`
- `statusLabel(status: string): string`
- `EXPLORER` const = `https://stellar.expert/explorer/testnet`
- `getProfileData(userId: string)` — fetches that user's wallet, position, and transactions and
  returns `{ user, wallet, position, transactions, balance, deposited, series }`. Uses the cached
  `positions.lastValueUsdc` for balance (fast; no Soroban RPC on page render).

### Profile route — `src/app/u/[token]/page.tsx` (new)

- `export const dynamic = "force-dynamic"`.
- `const { token } = await params` (Next 16 params is async).
- Look up the user by `web_token`; `notFound()` if absent.
- Call `getProfileData(user.id)`; render `<ProfileView data={...} />`.

### Showcase route — `src/app/demo/page.tsx` (rewritten)

- Resolve the showcase user: by `DEMO_WEB_TOKEN` if set, else the first user that has a position
  (fallback: first user). If none, render a friendly empty state.
- Render the same `<ProfileView>`. No aggregate/all-users view remains.

### Presentational components — `src/components/`

- `ProfileView.tsx` (server) — composes the four sections from `getProfileData` output.
- `BalanceHero.tsx` (server) — current balance (USDC), total deposited, `+$X de rendimiento`
  when balance > deposited.
- `SavingsChart.tsx` (server) — section wrapper that renders the existing client `YieldChart`
  with the built series; shows an empty-state when fewer than 2 points.
- `TransactionList.tsx` (server) — deposits/withdrawals with date, status label, amount, and a
  "ver tx" link to stellar.expert when `isRealTx`.
- `ProfileInfo.tsx` (server) — display name, channel (Telegram/WhatsApp), wallet address (linked
  to explorer), join date.

`src/components/YieldChart.tsx` is unchanged and reused.

### Bot intent — `profile`

- `src/lib/gemini.ts`: add `"profile"` to the `IntentSchema` enum; document it in the system
  prompt; add keywords to `localClassify` (`perfil|web|link|ver mis ahorros|dashboard|mi cuenta`).
- `src/lib/actions/dispatch.ts`: `case "profile": return handleProfile(ctx)`.
- `src/lib/actions/profile.ts` (new): `handleProfile(ctx)` — if `ctx.user.webToken` is null,
  generate one (`crypto.randomBytes(24).toString("base64url")`) and persist it; build
  `${APP_BASE_URL}/u/${token}`; return a Spanish reply with the link.

### Env — `src/lib/env.ts` + `.env.example`

- `APP_BASE_URL` — public base URL for building links. Fallback `http://localhost:3002`.
- `DEMO_WEB_TOKEN` (optional) — pins which profile `/demo` showcases.

### Landing copy — `src/app/page.tsx`

Minor: the hero says savings happen "por WhatsApp"; update to mention WhatsApp **and** Telegram,
since both channels are live. CTA label/behaviour unchanged (still → `/demo`).

## Data Flow

1. User messages the bot "mi perfil".
2. `classifyIntent` → `{ intent: "profile" }`; `dispatch` → `handleProfile`.
3. `handleProfile` ensures `web_token`, returns `{APP_BASE_URL}/u/<token>`.
4. User opens the link. The RSC looks up the user by token, reads their wallet/position/tx, and
   renders the four sections.

## Error Handling

- Unknown/!found token at `/u/[token]` → `notFound()` (Next 404).
- `/demo` with no users / no showcase → friendly empty state (reuse current "Aún no hay
  ahorristas" copy).
- User without a wallet/position yet → sections show empty states ("Sin movimientos todavía",
  chart hidden until ≥2 points) — mirror current `/demo` behaviour.
- `handleProfile` when `APP_BASE_URL` unset → falls back to localhost (dev); still returns a link.

## Security / Privacy

- The `web_token` is a bearer secret: anyone with the link sees that user's balance, wallet
  address, and transactions. All of that is already public on-chain (stellar.expert), testnet
  only. Acceptable for the MVP demo.
- The web is **read-only**: no PIN entry, no fund movement, no key exposure — consistent with
  AGENTS.md ("AI never holds keys or moves funds autonomously"; web pages are read-only demo).
- Token entropy: 24 random bytes (192 bits) — not enumerable.
- Stays on Stellar **testnet** (explorer links and copy use testnet).

## Testing

- Unit tests for the pure helpers in `src/lib/savings.ts`: `netDeposited`, `isRealTx`,
  `buildSeries`, `statusLabel`, `round2`.
- `pnpm build` (and `pnpm typecheck`) must pass — no `any`, no `as unknown as`, no barrel files.

## Out of Scope (YAGNI)

- Web login / sessions / passkeys.
- Live Soroban RPC reads on page render (use cached `positions`).
- Auto-pushing the link on milestones (deposit/wallet creation) — bot command only.
- Editing profile data from the web (read-only).
- Token rotation / expiry UI.
