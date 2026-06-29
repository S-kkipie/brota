import { fmtUsdc } from "@/lib/savings";

export default function BalanceHero({
  balance,
  deposited,
}: {
  balance: number;
  deposited: number;
}) {
  const gain = balance - deposited;
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 backdrop-blur-xl">
      <p className="text-sm text-slate-400">Tu ahorro vale</p>
      <p className="mt-1 text-5xl font-extrabold text-emerald-400">${fmtUsdc(balance)}</p>
      <div className="mt-5 flex gap-8 text-sm">
        <div>
          <p className="text-slate-400">Aportado</p>
          <p className="mt-1 font-semibold text-white">${fmtUsdc(deposited)}</p>
        </div>
        {gain > 0 && (
          <div>
            <p className="text-slate-400">Rendimiento</p>
            <p className="mt-1 font-semibold text-emerald-500">+${fmtUsdc(gain)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
