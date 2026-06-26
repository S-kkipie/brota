# Brota — MVP Design (PULSO Hackathon)

> Stellar PULSO Hackathon 2026 · SCF Integration Track · Deadline **30 jun 2026**
> Producto: **Brota** — ahorro en dólares por WhatsApp, con yield (DeFindex) y coach IA.

## 1. Alcance del MVP (lo que SÍ debe funcionar en la demo)

Happy-path demostrable de punta a punta:

1. Usuario escribe a WhatsApp → webhook recibe el mensaje.
2. **Gemini** interpreta intención (depositar / consultar saldo / coach educativo) vía
   function-calling → acción estructurada.
3. `"ahorra 50"` → mueve USDC (testnet) a una **bóveda DeFindex** (deposit) → el saldo
   genera yield.
4. `"¿cuánto tengo?"` → lee posición en la bóveda + rendimiento acumulado → responde.
5. **Dashboard web read-only** refleja un usuario demo + **landing** que explica el producto.

Todo corre en **una sola app Next.js** desplegada como servidor Node persistente.

### Fuera de alcance (MVP) — son *stretch*/roadmap, no se prometen en demo

- Rampa fiat real PEN↔USDC (Anchor SEP-24/SEP-6). En demo se usa USDC de testnet.
- Wallet no-custodial real (passkey / smart wallet Soroban).
- Contrato de allowance/topes propio en Soroban (solo si sobra tiempo).
- Login web / cuentas web (identidad = número de WhatsApp).

## 2. Stack (locked)

| Capa | Elección | Razón |
|---|---|---|
| App | Next.js (App Router) + TypeScript | Landing + demo + API en un repo, un deploy |
| Deploy | Railway (Node persistente, `next start`) | NO serverless: webhook + tx Soroban son lentos |
| DB | Postgres (Supabase) + Drizzle ORM | Free, tipado. Users, tx log, posiciones |
| WhatsApp | Twilio WhatsApp Sandbox | Canal más rápido de montar para hackathon |
| IA | Gemini `@google/genai` (gemini-2.5-flash) | NLU + coach. Function-calling → intención |
| Stellar | `@stellar/stellar-sdk` + DeFindex SDK | Testnet. deposit/withdraw a bóveda = el yield |
| Web UI | Tailwind + shadcn/ui + recharts | Landing + gráfico de rendimiento. Mayormente RSC |
| Logging | logtape `@logtape/logtape` (locked) | Logs estructurados |

Descartado para MVP (roadmap post-hackathon): monorepo, Elysia, better-auth + better-auth-ui,
tanstack-query/form. Se reintroducen cuando exista app de usuario con login.

## 3. Arquitectura

```
WhatsApp (Twilio) ──webhook──▶ Next route handler /api/whatsapp
                                     │
                                     ▼
                            Gemini (NLU, function-calling)
                                     │  intención estructurada
                                     ▼
                            Action layer (lib/actions)
                              ├─ deposit  → DeFindex deposit (Stellar SDK)
                              ├─ balance  → DeFindex read + tx log
                              └─ coach    → respuesta educativa
                                     │
                          Postgres (Drizzle): users, tx, positions
                                     │
            Dashboard web (RSC, read-only) ◀── lee DB directo
```

Una sola app. Sin servicios separados. El webhook y las llamadas a Stellar viven en route
handlers de Next que corren en un servidor Node persistente (sin timeouts de serverless).

## 4. Modelo de datos (Drizzle)

- **users** — `id`, `whatsappNumber` (unique), `displayName?`, `pinHash?`, `createdAt`.
- **wallets** — `id`, `userId`, `stellarPublicKey`, `encryptedSecret` (custodial, cifrado en
  reposo), `createdAt`. Una por usuario en MVP.
- **transactions** — `id`, `userId`, `type` (deposit|withdraw), `amount`, `asset`,
  `stellarTxHash?`, `status` (pending|confirmed|failed), `createdAt`.
- **positions** — `id`, `userId`, `vaultId`, `shares`, `lastValueUsdc`, `updatedAt`. Snapshot
  de la posición en la bóveda DeFindex para lectura rápida del dashboard.
- **messages** — `id`, `userId`, `direction` (in|out), `body`, `intent?`, `createdAt`. Log de
  conversación para depurar la demo.

## 5. Módulos

- `lib/log.ts` — config logtape (sinks, categorías).
- `lib/db.ts` + `db/schema.ts` — Drizzle + Postgres.
- `lib/gemini.ts` — cliente `@google/genai`, definición de tools/intents.
- `lib/stellar.ts` — config testnet, server RPC, helpers de keypair (cifrado/descifrado).
- `lib/defindex.ts` — wrappers deposit/withdraw/read sobre la bóveda.
- `lib/actions/*` — `deposit.ts`, `balance.ts`, `coach.ts` (lógica de cada intención).
- `app/api/whatsapp/route.ts` — webhook Twilio (verificación + dispatch).
- `app/page.tsx` — landing. `app/demo/page.tsx` — dashboard read-only (RSC).

## 6. Seguridad — custodia y firma (núcleo, leer con cuidado)

El MVP es **custodial-con-límites**, NO no-custodial. Hay que ser honestos en la demo:

- El backend genera y guarda un keypair Stellar por usuario; el secreto se almacena
  **cifrado en reposo** (clave de cifrado en variable de entorno / KMS, nunca en el repo).
- Un **PIN del usuario** autoriza cada movimiento de fondos; se guarda solo su hash.
- La IA (Gemini) **nunca** tiene las llaves ni mueve fondos por su cuenta: solo interpreta y
  redacta la intención. El movimiento de fondos requiere el paso de autorización (PIN).
- Límites de gasto: en MVP se validan en backend; el contrato Soroban de allowance que mueve
  los topes on-chain queda como *stretch*.
- En el pitch: presentar passkey / smart wallet Soroban como el roadmap a no-custodial real.
  No afirmar "non-custodial" mientras las llaves vivan en el servidor.

Secretos (`GEMINI_API_KEY`, `WALLET_ENCRYPTION_KEY`, Twilio, DB) solo en `.env` (gitignored)
y en el panel de Railway. Nunca commiteados. `.env.example` documenta las claves sin valores.

## 7. Riesgos (de-risk día 1)

1. **DeFindex SDK + bóveda testnet funcionando** — es la integración central; verificar
   PRIMERO que el deposit/withdraw/read funcione antes de construir encima.
2. **Twilio WhatsApp Sandbox** — tiempo de alta y verificación del número.
3. **Modelo de custodia** — decidido (custodial-con-límites); cifrado correcto del secreto.

## 8. Milestones (5 días, 25→30 jun)

- **D1** scaffold + DB + logtape + verificar DeFindex deposit/read en script aislado.
- **D2** webhook Twilio + Gemini intent (deposit/balance/coach) end-to-end en texto.
- **D3** deposit real a bóveda + balance read + tx log + PIN auth.
- **D4** dashboard web read-only + landing + gráfico de yield.
- **D5** deploy Railway + pulido demo + grabación + README final.

## 9. Decisiones abiertas (default elegido, cambiar si hace falta)

- Host: **Railway**. WhatsApp: **Twilio sandbox**. Custodia: **custodial-con-límites**.
- Cifrado del secreto: AES-256-GCM con `WALLET_ENCRYPTION_KEY` (32 bytes) en env.
