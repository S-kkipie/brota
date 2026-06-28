import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { TrendingUp, History } from "lucide-react";
import YieldChart from "@/components/YieldChart";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const allUsers = await db.select().from(users);

  // Since we might not have real data, let's inject a demo state if empty.
  const hasData = allUsers.length > 0;
  
  const mockChartData = [
    { date: "1 Jun", value: 100 },
    { date: "5 Jun", value: 101.5 },
    { date: "10 Jun", value: 103.2 },
    { date: "15 Jun", value: 105.8 },
    { date: "20 Jun", value: 108.1 },
    { date: "Hoy", value: 110.5 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Dashboard <span className="text-emerald-400">DeFindex</span></h1>
          <a href="/" className="text-sm font-medium text-slate-400 hover:text-white transition">← Volver al inicio</a>
        </div>
        
        {!hasData ? (
          <div className="p-12 border border-slate-800 rounded-3xl bg-slate-900/50 text-center backdrop-blur-xl">
            <p className="text-slate-400 mb-4 text-lg">Aún no hay usuarios en la base de datos.</p>
            <p className="text-sm">Envía un mensaje al bot de WhatsApp para empezar a generar datos reales.</p>
          </div>
        ) : (
          allUsers.map(user => (
            <div key={user.id} className="mb-12 border border-slate-800 rounded-3xl overflow-hidden bg-slate-900/50 backdrop-blur-xl hover:border-emerald-500/30 transition-colors">
              <div className="p-8 border-b border-slate-800 bg-slate-900/80">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{user.whatsappNumber}</h2>
                    <p className="text-slate-400 text-sm mt-1">Usuario Activo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Balance Total (USDC)</p>
                    <p className="text-4xl font-extrabold text-emerald-400 mt-1">$110.50</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 p-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-emerald-400" />
                    Rendimiento Histórico
                  </h3>
                  <YieldChart data={mockChartData} />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <History className="mr-2 h-5 w-5 text-emerald-400" />
                    Últimos Movimientos
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 transition-colors border border-slate-700/50">
                      <div>
                        <p className="font-medium text-emerald-400">Depósito DeFindex</p>
                        <p className="text-xs text-slate-400 mt-1">Hace 2 horas</p>
                      </div>
                      <p className="font-bold">+$50.00 USDC</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
