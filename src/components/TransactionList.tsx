import { History } from "lucide-react";
import { fmtUsdc, fmtDate, isRealTx, statusLabel, EXPLORER } from "@/lib/savings";
import type { Transaction } from "@/db/schema";

export default function TransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <div>
      <h3 className="mb-4 flex items-center text-lg font-semibold">
        <History className="mr-2 h-5 w-5 text-emerald-400" />
        Últimos movimientos
      </h3>
      {transactions.length === 0 ? (
        <p className="text-sm text-slate-500">Sin movimientos todavía.</p>
      ) : (
        <div className="space-y-3">
          {transactions.slice(0, 8).map((t) => (
            <div
              key={t.id}
              className="flex justify-between rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
            >
              <div>
                <p className="font-medium text-emerald-400">
                  {t.type === "deposit" ? "Depósito" : "Retiro"} DeFindex
                </p>
                <p className="mt-1 text-xs text-slate-400">
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
              <p
                className={`font-bold ${
                  t.type === "deposit" ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {t.type === "deposit" ? "+" : "−"}${fmtUsdc(t.amount)} {t.asset}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
