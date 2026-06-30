import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyIntent } from "@/lib/gemini";

test("local classifier routes profile keywords to profile intent", async () => {
  delete process.env.GEMINI_API_KEY;
  for (const msg of [
    "mi perfil",
    "mándame el link",
    "ver mis ahorros en la web",
    "abrir dashboard",
  ]) {
    const intent = await classifyIntent(msg);
    assert.equal(intent.intent, "profile", `expected profile for "${msg}"`);
  }
});

test("local classifier still routes deposit and balance", async () => {
  delete process.env.GEMINI_API_KEY;
  assert.equal((await classifyIntent("ahorra 50")).intent, "deposit");
  assert.equal((await classifyIntent("cuánto tengo")).intent, "balance");
});

test("local classifier routes withdraw keywords to withdraw intent with amount", async () => {
  delete process.env.GEMINI_API_KEY;
  for (const msg of ["retira 20", "quiero sacar 15", "retírame 30 dólares"]) {
    const intent = await classifyIntent(msg);
    assert.equal(intent.intent, "withdraw", `expected withdraw for "${msg}"`);
  }
  assert.equal((await classifyIntent("retira 20")).amountUsdc, 20);
  // Saving ("ahorra") must NOT be misread as a withdrawal.
  assert.equal((await classifyIntent("ahorra 50")).intent, "deposit");
});

test("local classifier routes address and activate intents", async () => {
  delete process.env.GEMINI_API_KEY;
  for (const msg of ["mi dirección", "cómo deposito", "dónde mando mi plata", "fondear mi billetera"]) {
    assert.equal((await classifyIntent(msg)).intent, "address", `expected address for "${msg}"`);
  }
  for (const msg of ["activar", "habilitar usdc", "activa mi billetera"]) {
    assert.equal((await classifyIntent(msg)).intent, "activate", `expected activate for "${msg}"`);
  }
  // "ahorra" still saves; it is distinct from depositing funds into the wallet.
  assert.equal((await classifyIntent("ahorra 50")).intent, "deposit");
});
