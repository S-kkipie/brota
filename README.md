# Brota — Ahorro en dólares por WhatsApp y Telegram (Perú)

> **Brota** · Stellar PULSO Hackathon 2026 · SCF Integration Track · Entrega **30 jun 2026**

Ahorro en dólares **por WhatsApp y Telegram**, con una IA que te enseña y te acompaña — y la
plata que guardas **rinde sola**. Sin app que descargar, sin saber cripto.

> **Tu plata Brota sola.**

## El problema

- ~40% de adultos en Perú **no bancarizados**; 71% economía informal.
- El que ahorra en soles pierde poder adquisitivo; no tiene acceso fácil a dólares
  ni a rendimiento.
- Las apps cripto existentes dejan el saldo **muerto a 0%** y exigen entender cripto.

## La propuesta

Coge lo ya validado (Félix Pago: WhatsApp + Stellar + IA, cripto escondida,
$15.5M Serie A) y le suma el valor que nadie da:

- **Yield** sobre el ahorro vía **DeFindex** (bóvedas de rendimiento sobre Soroban).
- **Lado receptor / ahorrador local**, no solo remesa de ida.
- **Coach IA** en español por WhatsApp y Telegram que educa y redacta, **nunca custodia**.
- Foco **Perú / corredor andino**.

## Seguridad (principio núcleo)

**La IA sugiere y redacta. El usuario firma. El backend limita.**
La IA nunca tiene las llaves ni puede mover fondos sola.

```
Usuario (WhatsApp/Telegram) → IA (entiende/educa/redacta tx, sin llaves)
  → Usuario autoriza con PIN → Backend ejecuta + valida topes
  → Stellar + DeFindex (yield)
```

Custodia: **custodial-con-límites** en MVP. Keypair por usuario, secreto **cifrado en reposo**
(AES-256-GCM), PIN guardado solo como hash. Passkey / smart wallet Soroban = roadmap a
no-custodial real; no afirmamos "non-custodial" mientras las llaves vivan en el servidor.

## Stack / Integración (SCF Integration Track)

- **Next.js (App Router) + TypeScript** — landing + perfil web read-only + API, un repo, un deploy.
- **Stellar / Soroban** (`@stellar/stellar-sdk` v16) — testnet, firma y submit de transacciones.
- **DeFindex** (`@defindex/sdk`) — bóvedas de rendimiento; el SDK arma el XDR, el server firma.
- **Gemini** (`@google/genai`, gemini-2.5-flash) — NLU + coach vía function-calling.
- **WhatsApp Cloud API** + **Telegram Bot API** — dos canales de entrada, núcleo compartido.
- **SQLite (libSQL) + Drizzle ORM** — users, wallets, transactions, positions.
- **Tailwind + shadcn/ui + recharts** — UI web.
- Deploy: **Railway** (`next start`, Node persistente).

## Estado

**Funciona hoy (demo de punta a punta, testnet):**

- ✅ Entrada por WhatsApp y Telegram, webhooks verificados (firma Meta / secret token Telegram).
- ✅ Wallet custodial creada al primer contacto, secreto cifrado, fondeo XLM por friendbot.
- ✅ Depósito real on-chain a bóveda DeFindex con autorización por PIN.
- ✅ Lectura de saldo + rendimiento.
- ✅ Web: landing + perfil por link mágico (`/u/<token>`) con saldo, gráfico y transacciones.

**Roadmap (declarado, fuera del MVP):**

- Rampa fiat PEN↔USDC (Anchor SEP-24/SEP-6). En demo se usa USDC de testnet.
- Wallet no-custodial real (passkey / smart wallet Soroban).
- Contrato Soroban propio de allowance/topes on-chain.

Spec y diseño en `docs/superpowers/`. Guía para agentes/humanos en `AGENTS.md`.

## Equipo

Repo público requerido por bases. Equipo 2–4 personas.

## Licencia

MIT — ver [LICENSE](./LICENSE).
