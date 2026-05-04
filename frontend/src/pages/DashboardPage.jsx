import React, { useEffect, useState } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Users, Clock, CalendarCheck, Baby, HeartHandshake, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      navigate("/login", { replace: true });
      return;
    }
    api.get("/visits/stats").then(r => setStats(r.data)).catch(() => {});
  }, [user, loading, navigate]);

  const maxDay = stats ? Math.max(1, ...stats.ultimos_7_dias.map(d => d.total)) : 1;

  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <Header />
      <main className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-14 fade-in-up">
        <div className="mb-10">
          <div className="label-up mb-3">Dashboard</div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-[#1F2924]">Visão geral</h1>
          <p className="text-[#5C6B62] mt-2">Estatísticas em tempo real da atividade da instituição.</p>
        </div>

        {!stats ? (
          <div className="py-24 text-center text-[#5C6B62]">A carregar estatísticas...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
              <StatCard icon={Users} color="#4A7C59" label="Dentro agora" value={stats.dentro} testid="stat-dentro" />
              <StatCard icon={CalendarCheck} color="#C26D5C" label="Hoje" value={stats.hoje} testid="stat-hoje" />
              <StatCard icon={Clock} color="#4A7C59" label="Tempo médio" value={`${stats.tempo_medio_min} min`} testid="stat-tempo" />
              <StatCard icon={TrendingUp} color="#C26D5C" label="Total registos" value={stats.total} testid="stat-total" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="card-crisp p-8 lg:col-span-2" data-testid="chart-7days">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="label-up mb-1">Últimos 7 dias</div>
                    <div className="font-heading text-2xl text-[#1F2924]">Visitas por dia</div>
                  </div>
                </div>
                <div className="flex items-end gap-3 h-56">
                  {stats.ultimos_7_dias.map((d, i) => {
                    const pct = (d.total / maxDay) * 100;
                    const date = new Date(d.dia + "T12:00:00");
                    const lbl = date.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "");
                    return (
                      <div key={d.dia} className="flex-1 flex flex-col items-center gap-2">
                        <div className="text-xs text-[#5C6B62] tabular-nums">{d.total}</div>
                        <div className="w-full rounded-t-lg bg-[#4A7C59] transition-all" style={{ height: `${Math.max(pct, 4)}%`, opacity: 0.3 + (i / 7) * 0.7 }} />
                        <div className="label-up text-[10px]">{lbl}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card-crisp p-8 flex flex-col gap-6" data-testid="split-inside">
                <div>
                  <div className="label-up mb-1">Dentro agora</div>
                  <div className="font-heading text-2xl text-[#1F2924]">Por instituição</div>
                </div>
                <div className="flex-1 flex flex-col gap-5">
                  <SplitRow icon={Baby} color="#4A7C59" label="Creche / Infantário" value={stats.creche_dentro} />
                  <SplitRow icon={HeartHandshake} color="#C26D5C" label="Lar de Idosos" value={stats.lar_dentro} />
                </div>
                <button onClick={() => navigate("/historico")} className="btn-ghost px-5 py-3 text-sm" data-testid="go-history">Ver histórico completo</button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, testid }) {
  return (
    <div className="card-crisp p-6" data-testid={testid}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${color}15`, color }}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="label-up mb-1">{label}</div>
      <div className="font-heading text-3xl text-[#1F2924] tabular-nums">{value}</div>
    </div>
  );
}

function SplitRow({ icon: Icon, color, label, value }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="text-sm text-[#5C6B62]">{label}</div>
        <div className="font-heading text-2xl text-[#1F2924] tabular-nums">{value}</div>
      </div>
    </div>
  );
}
