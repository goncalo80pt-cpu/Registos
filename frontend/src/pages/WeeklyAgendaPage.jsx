import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Calendar, Building2, Phone, X, Check } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function startOfWeek(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}
function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}
function shortDate(d) {
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
}

export default function WeeklyAgendaPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [bookings, setBookings] = useState([]);
  const [locations, setLocations] = useState({});
  const [fetching, setFetching] = useState(true);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const [rs, ls] = await Promise.all([
        api.get("/bookings", { params: { date_from: fmtDate(weekStart), date_to: fmtDate(weekEnd) } }),
        api.get("/locations"),
      ]);
      setBookings(rs.data);
      const map = {}; ls.data.forEach(l => { map[l.key] = l.label; });
      setLocations(map);
    } catch {
      toast.error("Erro a carregar agenda");
    } finally {
      setFetching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime()]);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) { navigate("/login?next=/agenda", { replace: true }); return; }
    load();
  }, [user, loading, load, navigate]);

  const moveWeek = (delta) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const concluir = async (id) => {
    try { await api.post(`/bookings/${id}/conclude`); toast.success("Concluída"); load(); } catch { toast.error("Erro"); }
  };
  const cancelar = async (id) => {
    if (!window.confirm("Cancelar esta marcação?")) return;
    try { await api.post(`/bookings/${id}/cancel`); toast.success("Cancelada"); load(); } catch { toast.error("Erro"); }
  };

  // group by day
  const byDay = {};
  days.forEach(d => { byDay[fmtDate(d)] = []; });
  bookings.forEach(b => {
    const key = fmtDate(new Date(b.data_hora));
    if (byDay[key]) byDay[key].push(b);
  });
  Object.values(byDay).forEach(list => list.sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora)));

  return (
    <div className="min-h-screen" data-testid="agenda-page">
      <Header />
      <main className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-14 fade-in-up">
        <div className="mb-6">
          <div className="label-up mb-3">Administração</div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-[#1F2924]">Agenda da semana</h1>
        </div>

        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => moveWeek(-1)} className="btn-ghost p-3" data-testid="prev-week" title="Semana anterior"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={goToday} className="btn-ghost px-4 py-2 text-sm" data-testid="today-btn">Esta semana</button>
            <button onClick={() => moveWeek(1)} className="btn-ghost p-3" data-testid="next-week" title="Próxima semana"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <div className="font-heading text-xl text-[#1F2924]">
            {shortDate(weekStart)} — {shortDate(weekEnd)}
          </div>
        </div>

        {fetching ? (
          <div className="card-crisp p-16 text-center text-[#5C6B62]">A carregar agenda...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3" data-testid="week-grid">
            {days.map((d, i) => {
              const key = fmtDate(d);
              const isToday = key === fmtDate(new Date());
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const list = byDay[key] || [];
              return (
                <div key={key} className={`card-crisp p-4 min-h-[200px] ${isToday ? "ring-2 ring-[#4A7C59]" : ""}`} data-testid={`day-${key}`}>
                  <div className="mb-3 pb-2 border-b border-[#E5E7E2]">
                    <div className={`label-up ${isWeekend ? "text-[#C26D5C]" : ""}`}>{WEEKDAYS[d.getDay()]}</div>
                    <div className={`font-heading text-2xl ${isToday ? "text-[#4A7C59]" : "text-[#1F2924]"}`}>{d.getDate()}</div>
                    <div className="text-xs text-[#5C6B62]">{d.toLocaleDateString("pt-PT", { month: "short" })}</div>
                  </div>
                  {list.length === 0 ? (
                    <div className="text-xs text-[#9aa39c] italic">Sem visitas</div>
                  ) : (
                    <div className="space-y-2">
                      {list.map(b => {
                        const dt = new Date(b.data_hora);
                        const hora = dt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
                        const isPast = dt < new Date();
                        const isCancelled = b.status === "cancelada";
                        const isDone = b.status === "concluida";
                        return (
                          <div
                            key={b.booking_id}
                            className={`p-2.5 rounded-md text-xs ${
                              isCancelled ? "bg-[#FAEFEB] line-through" :
                              isDone ? "bg-[#F1F2F0] text-[#5C6B62]" :
                              isPast ? "bg-[#FFF8E6] border border-[#F0D89A]" :
                              "bg-[#F1F2F0] border border-[#4A7C59]/20"
                            }`}
                            data-testid={`agenda-booking-${b.booking_id}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-bold text-[#1F2924] tabular-nums">{hora}</div>
                              <div className="flex items-center gap-1 text-[10px] text-[#5C6B62]">
                                <Building2 className="w-3 h-3" />
                                <span className="truncate">{(locations[b.local] || b.local).split(" ")[0]}</span>
                              </div>
                            </div>
                            <div className="font-medium text-[#1F2924] truncate" title={b.visitante_nome}>{b.visitante_nome}</div>
                            <div className="text-[#5C6B62] truncate" title={b.pessoa_visitada}>→ {b.pessoa_visitada}</div>
                            {b.telefone && <div className="text-[10px] text-[#5C6B62] flex items-center gap-1 mt-1"><Phone className="w-2.5 h-2.5" />{b.telefone}</div>}
                            {b.status === "marcada" && (
                              <div className="flex gap-1 mt-2">
                                <button onClick={() => concluir(b.booking_id)} className="text-[10px] px-2 py-1 rounded bg-[#4A7C59] text-white flex items-center gap-1" data-testid={`agenda-conclude-${b.booking_id}`}><Check className="w-3 h-3" />Concluir</button>
                                <button onClick={() => cancelar(b.booking_id)} className="text-[10px] px-2 py-1 rounded bg-white border border-[#E5E7E2] text-[#5C6B62] flex items-center gap-1" data-testid={`agenda-cancel-${b.booking_id}`}><X className="w-3 h-3" />Cancelar</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!fetching && bookings.length === 0 && (
          <div className="text-center text-[#5C6B62] mt-6" data-testid="agenda-empty">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Sem marcações nesta semana.
          </div>
        )}
      </main>
    </div>
  );
}
