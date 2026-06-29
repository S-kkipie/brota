import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { wallets, positions, transactions } from "@/db/schema";
import type { User, Wallet, Position, Transaction } from "@/db/schema";

export type YieldPoint = { date: string; value: number };

export const EXPLORER = "https://stellar.expert/explorer/testnet";

export const fmtUsdc = (n: number): string =>
  n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d: Date): string =>
  d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const isRealTx = (hash: string | null): boolean =>
  Boolean(hash && !hash.startsWith("mock_"));

export function netDeposited(txs: Transaction[]): number {
  return txs.reduce(
    (sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount),
    0,
  );
}

/** Cumulative savings over time from transactions, ending at the current value. */
export function buildSeries(
  txsAsc: Transaction[],
  currentValue: number | null,
): YieldPoint[] {
  let cum = 0;
  const points: YieldPoint[] = txsAsc.map((t) => {
    cum += t.type === "deposit" ? t.amount : -t.amount;
    return { date: fmtDate(t.createdAt), value: round2(cum) };
  });
  if (currentValue != null) points.push({ date: "Hoy", value: round2(currentValue) });
  return points;
}

export function statusLabel(status: string): string {
  if (status === "confirmed") return "confirmado";
  if (status === "pending") return "pendiente";
  if (status === "failed") return "fallido";
  return status;
}

export interface ProfileData {
  user: User;
  wallet: Wallet | null;
  position: Position | null;
  transactions: Transaction[];
  balance: number;
  deposited: number;
  series: YieldPoint[];
}

/**
 * Load everything a profile page renders for one user. Uses the cached
 * positions.lastValueUsdc for balance (fast; no Soroban RPC on page render).
 * transactions are returned newest-first.
 */
export async function getProfileData(user: User): Promise<ProfileData> {
  const [wallet, position, txs] = await Promise.all([
    db.query.wallets.findFirst({ where: eq(wallets.userId, user.id) }),
    db.query.positions.findFirst({ where: eq(positions.userId, user.id) }),
    db.select().from(transactions).where(eq(transactions.userId, user.id)),
  ]);

  const txDesc = [...txs].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const balance = position?.lastValueUsdc ?? 0;
  const deposited = netDeposited(txDesc);
  const series = buildSeries([...txDesc].reverse(), position ? balance : null);

  return {
    user,
    wallet: wallet ?? null,
    position: position ?? null,
    transactions: txDesc,
    balance,
    deposited,
    series,
  };
}
