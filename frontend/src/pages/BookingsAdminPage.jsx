import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Check, X, Trash2, Calendar, Clock, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";

function fmtDateTime(iso) {
  const d = new Date(iso);
  return {
    dia: d.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "long" }),
    hora: d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
  };
}

const STATUS_LABEL = {
  marcada: "Marcada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const STATUS_COLOR = {
  marcada: "#4A7C59",
  concluida: "#5C6B62",
  cancelada: "#C26D5C",
};

export default function BookingsAdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState({});
  const [filter, setFilter] = useState("todas");
  const [fetching, setFetching] = useState(true);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const params = filter === "todas" ? {} : { status: filter };
      const [rs, ls] = await Promise.all([
        api.get("/bookings", { params }),
        api.get("/locations"),
      ]);
      setRows(rs.data);
      const map = {}; ls.data.forEach(l => { map[l.key] = l.label; });
      setLocations(map);
    } catch {
      toast.error("Erro a carregar marcações");
    } finally {
      setFetching(false);
    }
  }, [filter]);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) { navigate("/login?next=/marcacoes", { replace: true }); return; }
    load();
  }, [user, loading, load, navigate]);

  const cancelar = async (id) => {
    if (!window.confirm("Cancelar esta marcação?")) return;
    try { await api.post(`/bookings/${id}/cancel`); toast.success("Marcação cancelada"); load(); }
    catch { toast.error("Erro ao cancelar"); }
  };
  const concluir = async (id) => {
    try { await api.post(`/bookings/${id}/conclude`); toast.success("Marcação concluída"); load(); }
    catch { toast.error("Erro"); }
  };
  const apagar = async (id) => {
    if (!window.confirm("Apagar definitivamente esta marcação?")) return;
    try { await api.delete(`/bookings/${id}`); toast.success("Marcação apagada"); load(); }
    catch { toast.error("Erro"); }
  };

  return (
    <div className="min-h-screen" data-testid="bookings-admin-page">
      <Header />
      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-14 fade-in-up">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="label-up mb-3">Administração</div>
            <h1 className="font-heading text-4xl md:text-5xl font-light text-[#1F2924]">Marcações de visitas</h1>
          </div>
          <button onClick={() => navigate("/marcar")} className="btn-primary px-6 py-3 text-sm" data-testid="new-booking-btn">+ Nova marcação</button>
        </div>

        <div className="flex gap-2 mb-6" data-testid="bookings-filter">
          {["todas", "marcada", "concluida", "cancelada"].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === s ? "bg-[#4A7C59] text-white" : "bg-[#F1F2F0] text-[#5C6B62] hover:bg-[#E5E7E2]"}`}
              data-testid={`filter-${s}`}
            >
              {s === "todas" ? "Todas" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {fetching ? (
          <div className="card-crisp p-16 text-center text-[#5C6B62]">A carregar...</div>
        ) : rows.length === 0 ? (
          <div className="card-crisp p-16 text-center" data-testid="bookings-empty">
            <Calendar className="w-12 h-12 mx-auto text-[#5C6B62] mb-4" />
            <h2 className="font-heading text-2xl text-[#1F2924] mb-2">Sem marcações</h2>
            <p className="text-[#5C6B62]">Nenhuma marcação para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="bookings-list">
            {rows.map(b => {
              const dt = fmtDateTime(b.data_hora);
              const past = new Date(b.data_hora) < new Date();
              return (
                <div key={b.booking_id} className="card-crisp p-6" data-testid={`booking-${b.booking_id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 label-up" style={{ color: STATUS_COLOR[b.status] }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[b.status] }} />
                      {STATUS_LABEL[b.status]}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#5C6B62]">
                      <Building2 className="w-3.5 h-3.5" />
                      {locations[b.local] || b.local}
                    </div>
                  </div>
                  <div className="font-heading text-xl font-medium text-[#1F2924] mb-1">{b.visitante_nome}</div>
                  <div className="text-sm text-[#5C6B62] mb-4">para visitar <span className="text-[#1F2924] font-medium">{b.pessoa_visitada}</span></div>
                  <div className="flex flex-wrap gap-3 text-sm text-[#1F2924] mb-4">
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-[#5C6B62]" />{dt.dia}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#5C6B62]" />{dt.hora}</span>
                    {b.telefone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-[#5C6B62]" />{b.telefone}</span>}
                  </div>
                  {b.observacoes && <div className="text-sm text-[#5C6B62] mb-4 p-3 bg-[#F9F8F6] rounded-md">{b.observacoes}</div>}
                  {b.status === "marcada" && (
                    <div className="flex gap-2">
                      <button onClick={() => concluir(b.booking_id)} className="btn-primary px-4 py-2 text-xs flex items-center gap-1" data-testid={`conclude-${b.booking_id}`}><Check className="w-3.5 h-3.5" /> Concluir</button>
                      <button onClick={() => cancelar(b.booking_id)} className="btn-ghost px-4 py-2 text-xs flex items-center gap-1" data-testid={`cancel-${b.booking_id}`}><X className="w-3.5 h-3.5" /> Cancelar</button>
                      <button onClick={() => apagar(b.booking_id)} className="btn-ghost px-3 py-2 text-xs flex items-center text-[#C26D5C]" data-testid={`delete-${b.booking_id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                  {b.status !== "marcada" && (
                    <button onClick={() => apagar(b.booking_id)} className="btn-ghost px-3 py-2 text-xs flex items-center gap-1 text-[#C26D5C]" data-testid={`delete-${b.booking_id}`}><Trash2 className="w-3.5 h-3.5" /> Apagar</button>
                  )}
                  {past && b.status === "marcada" && (
                    <div className="text-xs text-[#C26D5C] mt-2">Já passou — marque como concluída ou cancele.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
