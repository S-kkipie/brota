import { TrendingUp } from "lucide-react";
import YieldChart from "@/components/YieldChart";
import type { YieldPoint } from "@/lib/savings";

export default function SavingsChart({ series }: { series: YieldPoint[] }) {
  return (
    <div>
      <h3 className="mb-4 flex items-center text-lg font-semibold">
        <TrendingUp className="mr-2 h-5 w-5 text-emerald-400" />
        Crecimiento del ahorro
      </h3>
      {series.length >= 2 ? (
        <YieldChart data={series} />
      ) : (
        <p className="py-12 text-center text-sm text-slate-500">
          Aún no hay suficientes movimientos para graficar.
        </p>
      )}
    </div>
  );
}
