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
