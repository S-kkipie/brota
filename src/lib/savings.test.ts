import { test } from "node:test";
import assert from "node:assert/strict";
import {
  netDeposited,
  isRealTx,
  buildSeries,
  statusLabel,
  round2,
} from "@/lib/savings";
import type { Transaction } from "@/db/schema";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "t",
    userId: "u",
    type: "deposit",
    amount: 0,
    asset: "USDC",
    stellarTxHash: null,
    status: "confirmed",
    createdAt: new Date("2026-06-01T00:00:00Z"),
    ...partial,
  };
}

test("netDeposited sums deposits minus withdrawals", () => {
  const txs = [
    tx({ type: "deposit", amount: 100 }),
    tx({ type: "withdraw", amount: 30 }),
    tx({ type: "deposit", amount: 10 }),
  ];
  assert.equal(netDeposited(txs), 80);
});

test("netDeposited of empty is 0", () => {
  assert.equal(netDeposited([]), 0);
});

test("isRealTx: null and mock_ are not real, real hash is", () => {
  assert.equal(isRealTx(null), false);
  assert.equal(isRealTx("mock_abc"), false);
  assert.equal(isRealTx("abc123"), true);
});

test("round2 rounds to two decimals", () => {
  assert.equal(round2(80.126), 80.13);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(80), 80);
});

test("buildSeries accumulates and appends Hoy when currentValue given", () => {
  const txsAsc = [
    tx({ type: "deposit", amount: 50, createdAt: new Date("2026-06-01") }),
    tx({ type: "deposit", amount: 30, createdAt: new Date("2026-06-02") }),
    tx({ type: "withdraw", amount: 20, createdAt: new Date("2026-06-03") }),
  ];
  const series = buildSeries(txsAsc, 65);
  assert.equal(series.length, 4);
  assert.deepEqual(series.map((p) => p.value), [50, 80, 60, 65]);
  assert.equal(series[series.length - 1].date, "Hoy");
});

test("buildSeries omits Hoy when currentValue is null", () => {
  const series = buildSeries([tx({ type: "deposit", amount: 10 })], null);
  assert.equal(series.length, 1);
  assert.equal(series[0].value, 10);
});

test("statusLabel maps known statuses, passes through unknown", () => {
  assert.equal(statusLabel("confirmed"), "confirmado");
  assert.equal(statusLabel("pending"), "pendiente");
  assert.equal(statusLabel("failed"), "fallido");
  assert.equal(statusLabel("weird"), "weird");
});
