import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { users, wallets, transactions, positions } from "@/db/schema";
import type { Transaction } from "@/db/schema";
import { TrendingUp, History, Wallet, Users, PiggyBank } from "lucide-react";
import YieldChart from "@/components/YieldChart";
import type { YieldPoint } from "@/components/YieldChart";

export const dynamic = "force-dynamic";

const fmtUsdc = (n: number) =>
  n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
const round2 = (n: number) => Math.round(n * 100) / 100;
const isRealTx = (hash: string | null) => Boolean(hash && !hash.startsWith("mock_"));
const EXPLORER = "https://stellar.expert/explorer/testnet";

function netDeposited(txs: Transaction[]): number {
  return txs.reduce(
    (sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount),
    0,
  );
}

/** Cumulative savings over time from real transactions, ending at current value. */
function buildSeries(txsAsc: Transaction[], currentValue: number | null): YieldPoint[] {
  let cum = 0;
  const points: YieldPoint[] = txsAsc.map((t) => {
    cum += t.type === "deposit" ? t.amount : -t.amount;
    return { date: fmtDate(t.createdAt), value: round2(cum) };
  });
  if (currentValue != null) points.push({ date: "Hoy", value: round2(currentValue) });
  return points;
}

export default async function DemoPage() {
  const [allUsers, allWallets, allPositions, allTx] = await Promise.all([
    db.select().from(users),
    db.select().from(wallets),
    db.select().from(positions),
    db.select().from(transactions),
  ]);

  const walletByUser = new Map(allWallets.map((w) => [w.userId, w]));
  const positionByUser = new Map(allPositions.map((p) => [p.userId, p]));
  const txByUser = new Map<string, Transaction[]>();
  for (const t of allTx) {
    const list = txByUser.get(t.userId) ?? [];
    list.push(t);
    txByUser.set(t.userId, list);
  }

  const totalValue = allPositions.reduce((s, p) => s + p.lastValueUsdc, 0);
  const totalDeposited = netDeposited(allTx);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">
            Dashboard <span className="text-emerald-400">Brota</span>
          </h1>
          <a href="/" className="text-sm font-medium text-slate-400 hover:text-white transition">
            ← Volver al inicio
          </a>
        </div>

        {/* Aggregate stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <Stat icon={<Users className="h-5 w-5" />} label="Ahorristas" value={String(allUsers.length)} />
          <Stat icon={<PiggyBank className="h-5 w-5" />} label="Total aportado" value={`$${fmtUsdc(totalDeposited)}`} />
          <Stat icon={<TrendingUp className="h-5 w-5" />} label="Valor actual" value={`$${fmtUsdc(totalValue)}`} />
        </div>

        {allUsers.length === 0 ? (
          <div className="p-12 border border-slate-800 rounded-3xl bg-slate-900/50 text-center backdrop-blur-xl">
            <p className="text-slate-400 mb-4 text-lg">Aún no hay ahorristas.</p>
            <p className="text-sm">Envía un mensaje al bot de WhatsApp para empezar a generar datos reales.</p>
          </div>
        ) : (
          allUsers.map((user) => {
            const wallet = walletByUser.get(user.id);
            const position = positionByUser.get(user.id);
            const txs = (txByUser.get(user.id) ?? []).sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );
            const balance = position?.lastValueUsdc ?? 0;
            const deposited = netDeposited(txs);
            const series = buildSeries([...txs].reverse(), position ? balance : null);

            return (
              <div
                key={user.id}
                className="mb-12 border border-slate-800 rounded-3xl overflow-hidden bg-slate-900/50 backdrop-blur-xl hover:border-emerald-500/30 transition-colors"
              >
                <div className="p-8 border-b border-slate-800 bg-slate-900/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{user.whatsappNumber}</h2>
                      {wallet && (
                        <a
                          href={`${EXPLORER}/account/${wallet.stellarPublicKey}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 text-xs mt-1 inline-flex items-center gap-1 hover:text-emerald-400 transition font-mono"
                        >
                          <Wallet className="h-3 w-3" />
                          {wallet.stellarPublicKey.slice(0, 6)}…{wallet.stellarPublicKey.slice(-6)}
                        </a>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Balance (USDC)</p>
                      <p className="text-4xl font-extrabold text-emerald-400 mt-1">${fmtUsdc(balance)}</p>
                      {balance > deposited && (
                        <p className="text-xs text-emerald-500/80 mt-1">
                          +${fmtUsdc(balance - deposited)} de rendimiento
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 p-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <TrendingUp className="mr-2 h-5 w-5 text-emerald-400" />
                      Crecimiento del ahorro
                    </h3>
                    {series.length >= 2 ? (
                      <YieldChart data={series} />
                    ) : (
                      <p className="text-slate-500 text-sm py-12 text-center">
                        Aún no hay suficientes movimientos para graficar.
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <History className="mr-2 h-5 w-5 text-emerald-400" />
                      Últimos movimientos
                    </h3>
                    {txs.length === 0 ? (
                      <p className="text-slate-500 text-sm">Sin movimientos todavía.</p>
                    ) : (
                      <div className="space-y-3">
                        {txs.slice(0, 6).map((t) => (
                          <div
                            key={t.id}
                            className="flex justify-between p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 transition-colors border border-slate-700/50"
                          >
                            <div>
                              <p className="font-medium text-emerald-400">
                                {t.type === "deposit" ? "Depósito" : "Retiro"} DeFindex
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {fmtDate(t.createdAt)} · {statusLabel(t.status)}
                                {isRealTx(t.stellarTxHash) && (
                                  <>
                                    {" · "}
                                    <a
                                      href={`${EXPLORER}/tx/${t.stellarTxHash}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline hover:text-emerald-400"
                                    >
                                      ver tx
                                    </a>
                                  </>
                                )}
                              </p>
                            </div>
                            <p className={`font-bold ${t.type === "deposit" ? "text-emerald-400" : "text-amber-400"}`}>
                              {t.type === "deposit" ? "+" : "−"}${fmtUsdc(t.amount)} {t.asset}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="p-5 border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold mt-2 text-white">{value}</p>
    </div>
  );
}

function statusLabel(status: string): string {
  if (status === "confirmed") return "confirmado";
  if (status === "pending") return "pendiente";
  if (status === "failed") return "fallido";
  return status;
}
