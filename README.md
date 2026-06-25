# PULSO Hackathon — Ahorro en dólares por WhatsApp (Perú)

> Nombre de producto: **TBD** · Stellar PULSO Hackathon 2026 · SCF Integration Track

Ahorro en dólares **por WhatsApp**, con una IA que te enseña y te acompaña — y la
plata que guardas **rinde sola**. Sin app que descargar, sin saber cripto.

## El problema

- ~40% de adultos en Perú **no bancarizados**; 71% economía informal.
- El que ahorra en soles pierde poder adquisitivo; no tiene acceso fácil a dólares
  ni a rendimiento.
- Las apps cripto existentes dejan el saldo **muerto a 0%** y exigen entender cripto.

## La propuesta

Coge lo ya validado (Félix Pago: WhatsApp + Stellar + IA, cripto escondida,
$15.5M Serie A) y le suma el valor que nadie da:

- **Yield** sobre el ahorro vía **DeFindex** (bóvedas non-custodial sobre Soroban).
- **Lado receptor / ahorrador local**, no solo remesa de ida.
- **Coach IA** en español por WhatsApp que educa y redacta, **nunca custodia**.
- Foco **Perú / corredor andino**.

## Seguridad (principio núcleo)

**La IA sugiere y redacta. El contrato limita. El usuario firma.**
La IA nunca tiene las llaves ni puede mover fondos sola.

```
Usuario (WhatsApp) → IA (entiende/educa/redacta tx, sin llaves)
  → Usuario firma (PIN/passkey) → Contrato Soroban (ejecuta + topes)
  → Stellar + DeFindex (yield) + Anchor (rampa PEN↔USDC)
```

## Stack / Integración (SCF Integration Track)

- **Stellar / Soroban** — rieles + contrato de allowance/topes.
- **DeFindex** — bóvedas de rendimiento (SDK, deposit/withdraw).
- **Anchor** (SEP-24/SEP-6) — rampa PEN ↔ USDC.
- **WhatsApp Business API** — canal/distribución.
- **IA (Claude)** — NLU + coach + redacción de transacciones.

## Estado

🚧 En definición. Spec en `docs/`. Hackathon: entrega **30 jun 2026**.

## Equipo

Repo público requerido por bases. Equipo 2–4 personas.

## Licencia

MIT — ver [LICENSE](./LICENSE).
