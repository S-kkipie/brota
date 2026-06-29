import type { ProfileData } from "@/lib/savings";
import BalanceHero from "@/components/BalanceHero";
import SavingsChart from "@/components/SavingsChart";
import TransactionList from "@/components/TransactionList";
import ProfileInfo from "@/components/ProfileInfo";

export default function ProfileView({ data }: { data: ProfileData }) {
  const name = data.user.displayName ?? "Ahorrista";

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-sans text-slate-50 selection:bg-emerald-500/30 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Hola, <span className="text-emerald-400">{name}</span> 🌱
          </h1>
          <a href="/" className="text-sm text-slate-400 transition hover:text-white">
            ← Inicio
          </a>
        </div>
        <div className="space-y-8">
          <BalanceHero balance={data.balance} deposited={data.deposited} />
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl sm:p-8">
            <SavingsChart series={data.series} />
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl sm:p-8">
            <TransactionList transactions={data.transactions} />
          </div>
          <ProfileInfo user={data.user} wallet={data.wallet} />
        </div>
      </div>
    </div>
  );
}
