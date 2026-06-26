# AGENTS.md — Brota

Guidance for AI agents (and humans) working in this repo. Read before editing.

## What this is

**Brota** — dollar savings over WhatsApp for Peru, on Stellar. An AI coach interprets the
user, DeFindex vaults generate yield, the user signs. Stellar PULSO Hackathon 2026, SCF
Integration Track. Deadline **30 jun 2026**. Full design: `docs/superpowers/specs/2026-06-25-brota-mvp-design.md`.

This is a 5-day hackathon MVP. Bias to: working demo > completeness, simple > clever,
one repo / one deploy > microservices.

## Stack (locked — do not swap without asking)

- **Next.js (App Router) + TypeScript** — frontend (landing + read-only demo) AND API routes.
- **Postgres (Supabase) + Drizzle ORM** — `db/schema.ts` is the source of truth.
- **Gemini `@google/genai`** (gemini-2.5-flash) — NLU + coach, via function-calling.
- **Stellar `@stellar/stellar-sdk` + DeFindex SDK** — testnet. DeFindex vault = the yield.
- **Twilio WhatsApp Sandbox** — inbound webhook at `app/api/whatsapp/route.ts`.
- **logtape `@logtape/logtape`** — all logging. No `console.log` in committed code.
- **Tailwind + shadcn/ui + recharts** — web UI.
- Deploy: **Railway** (`next start`, persistent Node — NOT Vercel serverless).

Package manager: **pnpm**. Node 24.

## Architecture rules

- One Next.js app. No separate backend service. Webhook + Stellar live in route handlers.
- Web pages are read-only demo: prefer **RSC** fetching the DB directly. No client data layer
  (no tanstack-query/form in MVP).
- Business logic lives in `lib/actions/*` (one file per intent), not in route handlers.
- Shared clients in `lib/`: `db.ts`, `gemini.ts`, `stellar.ts`, `defindex.ts`, `log.ts`.

## Security — non-negotiable

- **AI never holds keys or moves funds autonomously.** Gemini only interprets and drafts
  intent. Any fund movement requires the user's **PIN authorization** step.
- Wallets are **custodial-with-limits** in MVP: per-user Stellar keypair, secret **encrypted
  at rest** (AES-256-GCM, key in `WALLET_ENCRYPTION_KEY` env). PIN stored as hash only.
- Do **not** claim "non-custodial" anywhere while keys live server-side. Passkey/smart-wallet
  is roadmap, not MVP.
- **No secrets in the repo.** `GEMINI_API_KEY`, `WALLET_ENCRYPTION_KEY`, Twilio creds, DB URL
  live in `.env` (gitignored) and Railway only. Keep `.env.example` updated with keys, no values.
- Stellar **testnet only** until explicitly switched. Never point at mainnet in code/tests.

## Workflow

- Verify before claiming done: `pnpm build` (or `pnpm typecheck`) must pass. Run it; show output.
- Small, focused commits. Conventional Commits. Spanish or English body OK.
- Do not introduce dropped deps (Elysia, better-auth, monorepo tooling) without asking.
- When touching the data model, update `db/schema.ts` and generate a Drizzle migration.

## Commands

```bash
pnpm dev          # local dev
pnpm build        # production build (must pass before done)
pnpm typecheck    # tsc --noEmit
pnpm db:generate  # drizzle-kit generate (after schema change)
pnpm db:push      # push schema to DB
```
