import React, { useEffect, useState } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Users, Clock, CalendarCheck, Building2, TrendingUp, AlertTriangle, Phone, Trophy } from "lucide-react";

function formatOverdueDelta(regressoIso) {
  if (!regressoIso) return "";
  const due = new Date(regressoIso);
  const diffMin = Math.floor((Date.now() - due.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin} min em atraso`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h < 24) return `${h}h ${m}m em atraso`;
  const d = Math.floor(h / 24);
  const restH = h % 24;
  return `${d}d ${restH}h em atraso`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

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
    const fetchStats = () => api.get("/visits/stats").then(r => setStats(r.data)).catch(() => {});
    fetchStats();
    // refresh every 60s so overdue alerts stay current
    const id = setInterval(fetchStats, 60000);
    return () => clearInterval(id);
  }, [user, loading, navigate]);

  const maxDay = stats ? Math.max(1, ...stats.ultimos_7_dias.map(d => d.total)) : 1;
  const overdue = stats?.saidas_em_atraso || [];
  const topUtentes = stats?.top_utentes_mes || [];
  const maxTopVisits = topUtentes.length > 0 ? Math.max(1, ...topUtentes.map(u => u.total)) : 1;

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
            {overdue.length > 0 && (
              <div
                className="rounded-2xl border-2 border-[#C26D5C] bg-[#FBEDE9] p-6 md:p-7 mb-8 shadow-sm"
                data-testid="overdue-alert-card"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#C26D5C] text-white shrink-0 animate-pulse">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="label-up text-[#8A3A2A] mb-1">Atenção</div>
                    <div className="font-heading text-2xl text-[#1F2924] mb-3">
                      {overdue.length} {overdue.length === 1 ? "utente em atraso" : "utentes em atraso"} no regresso
                    </div>
                    <div className="space-y-3">
                      {overdue.map((s) => (
                        <div
                          key={s.saida_id}
                          className="bg-white rounded-xl p-4 border border-[#E8C9C0] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          data-testid={`overdue-row-${s.saida_id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-heading text-lg text-[#1F2924]">{s.utente_nome}</div>
                            <div className="text-sm text-[#5C6B62] flex items-center gap-1.5 flex-wrap">
                              <Building2 className="w-3.5 h-3.5" />
                              <span>{s.local_label}</span>
                              <span>·</span>
                              <span>{s.motivo}</span>
                            </div>
                            <div className="text-xs text-[#5C6B62] mt-1 tabular-nums">
                              Regresso previsto: <strong className="text-[#1F2924]">{formatDateTime(s.regresso_previsto)}</strong>
                            </div>
                            {s.responsavel_nome && (
                              <div className="text-xs text-[#5C6B62] mt-0.5">
                                Acompanhante: <strong className="text-[#1F2924]">{s.responsavel_nome}</strong>
                                {s.responsavel_telefone && (
                                  <> · <Phone className="inline w-3 h-3" /> {s.responsavel_telefone}</>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:items-end gap-2">
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#C26D5C] text-white tabular-nums whitespace-nowrap"
                              data-testid={`overdue-delta-${s.saida_id}`}
                            >
                              {formatOverdueDelta(s.regresso_previsto)}
                            </span>
                            <button
                              onClick={() => navigate("/saidas")}
                              className="text-xs text-[#8A3A2A] underline hover:text-[#5d271c]"
                              data-testid={`overdue-go-saidas-${s.saida_id}`}
                            >
                              Registar regresso
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
              <StatCard icon={Users} color="#4A7C59" label="Dentro agora" value={stats.dentro} testid="stat-dentro" />
              <StatCard icon={CalendarCheck} color="#C26D5C" label="Hoje" value={stats.hoje} testid="stat-hoje" />
              <StatCard icon={Clock} color="#4A7C59" label="Tempo médio" value={`${stats.tempo_medio_min} min`} testid="stat-tempo" />
              <StatCard icon={TrendingUp} color="#C26D5C" label="Total registos" value={stats.total} testid="stat-total" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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
                  <div className="font-heading text-2xl text-[#1F2924]">Por local</div>
                </div>
                <div className="flex-1 flex flex-col gap-4">
                  {stats.por_local && Object.entries(stats.por_local).map(([key, val]) => (
                    <SplitRow key={key} icon={Building2} color="#4A7C59" label={val.label} value={val.dentro} />
                  ))}
                </div>
                <button onClick={() => navigate("/historico")} className="btn-ghost px-5 py-3 text-sm" data-testid="go-history">Ver histórico completo</button>
              </div>
            </div>

            <div className="card-crisp p-8" data-testid="top-utentes-card">
              <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <div>
                  <div className="label-up mb-1 flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5" /> Mês corrente
                  </div>
                  <div className="font-heading text-2xl text-[#1F2924]">Utentes mais visitados</div>
                  <p className="text-sm text-[#5C6B62] mt-1">Top 10 utentes por número de visitas recebidas este mês.</p>
                </div>
              </div>
              {topUtentes.length === 0 ? (
                <div className="py-10 text-center text-[#5C6B62] text-sm" data-testid="top-utentes-empty">
                  Ainda não há visitas registadas neste mês.
                </div>
              ) : (
                <ol className="space-y-3" data-testid="top-utentes-list">
                  {topUtentes.map((u, idx) => {
                    const pct = (u.total / maxTopVisits) * 100;
                    return (
                      <li
                        key={`${u.nome}-${u.local}-${idx}`}
                        className="flex items-center gap-4"
                        data-testid={`top-utente-${idx}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-[#F1F2F0] text-[#1F2924] font-heading text-sm flex items-center justify-center tabular-nums shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="font-medium text-[#1F2924] truncate">{u.nome}</div>
                            <div className="text-sm text-[#5C6B62] tabular-nums whitespace-nowrap">
                              <strong className="text-[#1F2924]">{u.total}</strong> {u.total === 1 ? "visita" : "visitas"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-[#F1F2F0] overflow-hidden">
                              <div
                                className="h-full bg-[#4A7C59] rounded-full transition-all"
                                style={{ width: `${pct}%`, opacity: 0.4 + (1 - idx / Math.max(topUtentes.length, 1)) * 0.6 }}
                              />
                            </div>
                            {u.local_label && (
                              <span className="text-[10px] text-[#5C6B62] flex items-center gap-1 whitespace-nowrap">
                                <Building2 className="w-3 h-3" />
                                {u.local_label}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
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
