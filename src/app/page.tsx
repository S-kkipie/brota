import Link from "next/link";
import { ArrowRight, Bot, Wallet, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-emerald-500/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-950 to-slate-950"></div>
        <div className="relative mx-auto max-w-5xl px-6 pt-32 pb-24 text-center">
          <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300 backdrop-blur-sm mb-8 animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
            Stellar PULSO Hackathon 2026
          </div>
          <h1 className="text-balance text-6xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-500">
            Tu plata <span className="text-emerald-400">Brota</span> sola.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg text-slate-300">
            Ahorra en dólares <strong>por WhatsApp y Telegram</strong>, con una IA que te enseña y te acompaña.
            La plata que guardas rinde sola mediante bóvedas DeFindex. Sin apps, sin saber cripto.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="group flex items-center justify-center rounded-full bg-emerald-500 px-8 py-4 font-semibold text-slate-950 transition-all hover:bg-emerald-400 hover:scale-105 hover:shadow-[0_0_40px_8px_rgba(16,185,129,0.3)]"
            >
              Ver Demo Dashboard
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://github.com/S-kkipie/brota"
              className="flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 px-8 py-4 font-semibold text-white backdrop-blur-md transition-all hover:bg-slate-700 hover:scale-105"
            >
              Ver en GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-32">
        <div className="grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon={<Bot className="h-8 w-8 text-emerald-400" />}
            title="Coach IA en tu chat"
            description="Hablas con Brota por WhatsApp o Telegram como a un amigo. La IA entiende tu intención, redacta por ti y te educa financieramente."
          />
          <FeatureCard 
            icon={<TrendingUp className="h-8 w-8 text-emerald-400" />}
            title="Yield Automático"
            description="Tu ahorro se convierte a USDC y genera rendimientos automáticamente en bóvedas DeFindex sobre Stellar."
          />
          <FeatureCard 
            icon={<Wallet className="h-8 w-8 text-emerald-400" />}
            title="Seguridad Custodial"
            description="Tú tienes el control con tu PIN. La IA sugiere y redacta; tú firmas. Las llaves se encriptan al máximo nivel."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-xl transition-all hover:border-emerald-500/50 hover:bg-slate-800/80 hover:-translate-y-2">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl transition-all group-hover:bg-emerald-500/20"></div>
      <div className="mb-6 inline-flex rounded-2xl bg-slate-800 p-4 shadow-inner">
        {icon}
      </div>
      <h3 className="mb-3 text-xl font-bold text-white">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
