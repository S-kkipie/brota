import Link from "next/link";
import { YieldChart, type YieldPoint } from "./yield-chart";

/**
 * Read-only demo dashboard. MVP uses mock data; once positions are persisted
 * (D3) this becomes an RSC reading the DB directly for a demo user.
 * TODO(D4): replace mock with a real query over positions/transactions.
 */
const MOCK_YIELD: YieldPoint[] = [
  { day: "Lun", value: 100.0 },
  { day: "Mar", value: 100.04 },
  { day: "Mié", value: 100.09 },
  { day: "Jue", value: 100.15 },
  { day: "Vie", value: 100.23 },
  { day: "Sáb", value: 100.31 },
  { day: "Dom", value: 100.4 },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 p-6">
      <p className="text-sm text-foreground/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-foreground/60 hover:underline">
        ← Brota
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Demo · Ana (usuario)</h1>
      <p className="mt-2 text-foreground/60">
        Vista de solo lectura. Datos de ejemplo (testnet) — el flujo real corre por WhatsApp.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Ahorro" value="$100.40" />
        <Stat label="Rendimiento (7d)" value="+$0.40" />
        <Stat label="APY aprox." value="~2.1%" />
      </div>

      <div className="mt-8 rounded-2xl border border-foreground/10 p-6">
        <h2 className="mb-4 text-lg font-semibold">Tu dinero rinde solo</h2>
        <YieldChart data={MOCK_YIELD} />
      </div>
    </main>
  );
}
