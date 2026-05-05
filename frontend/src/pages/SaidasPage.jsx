import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Plus, Calendar, Clock, Phone, Building2, Check, X, Trash2, LogOut, LogIn, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = { agendada: "Agendada", em_curso: "Em curso", concluida: "Concluída", cancelada: "Cancelada" };
const STATUS_COLOR = { agendada: "#4A7C59", em_curso: "#C26D5C", concluida: "#5C6B62", cancelada: "#9aa39c" };

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SaidasPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [locations, setLocations] = useState({});
  const [filter, setFilter] = useState("agendada");
  const [fetching, setFetching] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [utentes, setUtentes] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [form, setForm] = useState({
    utente_search: "",
    utente_id: "",
    local: "",
    saida_data: todayPlusDays(0),
    saida_hora: "09:00",
    regresso_data: todayPlusDays(0),
    regresso_hora: "17:00",
    motivo: "",
    responsavel_nome: "",
    responsavel_telefone: "",
    observacoes: "",
  });

  const userScopes = user?.scopes;
  const visibleLocations = (userScopes && userScopes !== "all" && Array.isArray(userScopes))
    ? Object.entries(locations).filter(([k]) => userScopes.includes(k))
    : Object.entries(locations);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const params = filter === "todas" ? {} : { status: filter };
      const [rs, ls] = await Promise.all([api.get("/saidas", { params }), api.get("/locations")]);
      setList(rs.data);
      const map = {}; ls.data.forEach(l => { map[l.key] = l.label; });
      setLocations(map);
    } catch { toast.error("Erro a carregar saídas"); }
    finally { setFetching(false); }
  }, [filter]);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) { navigate("/login?next=/saidas", { replace: true }); return; }
    load();
  }, [user, loading, load, navigate]);

  // Load utentes for the chosen local in the form
  useEffect(() => {
    if (!form.local) { setUtentes([]); return; }
    api.get("/utentes/public", { params: { local: form.local } })
      .then(r => setUtentes(r.data))
      .catch(() => setUtentes([]));
  }, [form.local]);

  const matches = (form.utente_search || "").trim().length >= 1
    ? utentes.filter(u => u.nome.toLowerCase().includes(form.utente_search.toLowerCase())).slice(0, 8)
    : utentes.slice(0, 8);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.utente_id) { toast.error("Escolha o utente"); return; }
    if (!form.motivo.trim()) { toast.error("Indique o motivo"); return; }
    const sp = new Date(`${form.saida_data}T${form.saida_hora}:00`);
    const rp = new Date(`${form.regresso_data}T${form.regresso_hora}:00`);
    if (rp <= sp) { toast.error("O regresso tem que ser depois da saída"); return; }
    try {
      await api.post("/saidas", {
        utente_id: form.utente_id,
        saida_prevista: sp.toISOString(),
        regresso_previsto: rp.toISOString(),
        motivo: form.motivo,
        responsavel_nome: form.responsavel_nome,
        responsavel_telefone: form.responsavel_telefone,
        observacoes: form.observacoes,
      });
      toast.success("Saída agendada");
      setShowAdd(false);
      setForm({ ...form, utente_search: "", utente_id: "", motivo: "", responsavel_nome: "", responsavel_telefone: "", observacoes: "" });
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Erro"); }
  };

  const iniciar = async (id) => {
    try { await api.post(`/saidas/${id}/iniciar`); toast.success("Saída registada"); load(); }
    catch { toast.error("Erro"); }
  };
  const regresso = async (id) => {
    try { await api.post(`/saidas/${id}/regresso`); toast.success("Regresso registado"); load(); }
    catch { toast.error("Erro"); }
  };
  const cancelar = async (id) => {
    if (!window.confirm("Cancelar esta saída?")) return;
    try { await api.post(`/saidas/${id}/cancel`); toast.success("Cancelada"); load(); }
    catch { toast.error("Erro"); }
  };
  const apagar = async (id) => {
    if (!window.confirm("Apagar definitivamente?")) return;
    try { await api.delete(`/saidas/${id}`); toast.success("Apagada"); load(); }
    catch { toast.error("Erro"); }
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="min-h-screen" data-testid="saidas-page">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-10 md:py-14 fade-in-up">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="label-up mb-3">Administração</div>
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-light text-[#1F2924]">Saídas dos utentes</h1>
            <p className="text-[#5C6B62] mt-2">Agendar e acompanhar saídas (consultas, visitas familiares, passeios).</p>
          </div>
          <button onClick={() => setShowAdd(s => !s)} className="btn-primary px-5 py-3 flex items-center gap-2 self-start" data-testid="add-saida-btn">
            <Plus className="w-4 h-4" /> Nova saída
          </button>
        </div>

        {showAdd && (
          <form onSubmit={submit} className="card-crisp p-6 md:p-8 mb-6 space-y-5" data-testid="add-saida-form">
            <h2 className="font-heading text-xl text-[#1F2924] mb-2">Agendar saída</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-up mb-2 block">Local</label>
                <select className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={form.local} onChange={e=>setForm({...form, local:e.target.value, utente_id:"", utente_search:""})} data-testid="saida-local">
                  <option value="">Escolher...</option>
                  {visibleLocations.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="relative">
                <label className="label-up mb-2 block">Utente</label>
                <input
                  className="input-kiosk !h-12 !text-base"
                  style={{height:'3rem',fontSize:'1rem'}}
                  value={form.utente_search}
                  onChange={(e) => { setForm({ ...form, utente_search: e.target.value, utente_id: "" }); setShowSugg(true); }}
                  onFocus={() => setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                  placeholder={form.local ? "Comece a escrever..." : "Escolha primeiro o local"}
                  disabled={!form.local}
                  data-testid="saida-utente"
                  autoComplete="off"
                />
                {showSugg && form.local && matches.length > 0 && (
                  <ul className="absolute left-0 right-0 mt-1 bg-white border border-[#E5E7E2] rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">
                    {matches.map(u => (
                      <li key={u.utente_id}
                        onMouseDown={(e) => { e.preventDefault(); setForm({...form, utente_id: u.utente_id, utente_search: u.nome}); setShowSugg(false); }}
                        className="px-4 py-2.5 cursor-pointer hover:bg-[#F1F2F0] text-[#1F2924] text-sm border-b border-[#F1F2F0] last:border-0"
                        data-testid={`saida-suggest-${u.utente_id}`}>{u.nome}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-up mb-2 block">Data e hora de saída</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={form.saida_data} onChange={e=>setForm({...form, saida_data:e.target.value})} data-testid="saida-data" />
                  <input type="time" className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={form.saida_hora} onChange={e=>setForm({...form, saida_hora:e.target.value})} data-testid="saida-hora" />
                </div>
              </div>
              <div>
                <label className="label-up mb-2 block">Data e hora de regresso</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={form.regresso_data} onChange={e=>setForm({...form, regresso_data:e.target.value})} data-testid="regresso-data" />
                  <input type="time" className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={form.regresso_hora} onChange={e=>setForm({...form, regresso_hora:e.target.value})} data-testid="regresso-hora" />
                </div>
              </div>
            </div>

            <div>
              <label className="label-up mb-2 block">Motivo</label>
              <input className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={form.motivo} onChange={e=>setForm({...form, motivo:e.target.value})} placeholder="Ex: Consulta médica, visita familiar, passeio..." data-testid="saida-motivo" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-up mb-2 block">Responsável (quem o acompanha)</label>
                <input className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={form.responsavel_nome} onChange={e=>setForm({...form, responsavel_nome:e.target.value})} placeholder="Nome do familiar/acompanhante" data-testid="saida-responsavel" />
              </div>
              <div>
                <label className="label-up mb-2 block">Telefone do responsável</label>
                <input className="input-kiosk !h-12 !text-base" style={{height:'3rem',fontSize:'1rem'}} value={form.responsavel_telefone} onChange={e=>setForm({...form, responsavel_telefone:e.target.value})} placeholder="9XX XXX XXX" data-testid="saida-telefone" />
              </div>
            </div>

            <div>
              <label className="label-up mb-2 block">Observações</label>
              <textarea rows={2} className="input-kiosk" style={{height:'auto',paddingTop:'0.75rem',paddingBottom:'0.75rem',fontSize:'1rem'}} value={form.observacoes} onChange={e=>setForm({...form, observacoes:e.target.value})} placeholder="Alguma nota..." data-testid="saida-obs" />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary px-5 py-3 text-sm flex items-center gap-2" data-testid="save-saida"><Check className="w-4 h-4" /> Agendar saída</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost px-5 py-3 text-sm">Cancelar</button>
            </div>
          </form>
        )}

        <div className="flex gap-2 mb-6 flex-wrap" data-testid="filter-bar">
          {["agendada", "em_curso", "concluida", "cancelada", "todas"].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === s ? "bg-[#4A7C59] text-white" : "bg-[#F1F2F0] text-[#5C6B62] hover:bg-[#E5E7E2]"}`} data-testid={`filter-${s}`}>
              {s === "todas" ? "Todas" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {fetching ? (
          <div className="card-crisp p-16 text-center text-[#5C6B62]">A carregar...</div>
        ) : list.length === 0 ? (
          <div className="card-crisp p-16 text-center" data-testid="saidas-empty">
            <Calendar className="w-12 h-12 mx-auto text-[#5C6B62] mb-4" />
            <p className="text-[#1F2924] font-heading text-xl">Sem saídas para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="saidas-list">
            {list.map(s => (
              <div key={s.saida_id} className="card-crisp p-6" data-testid={`saida-${s.saida_id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 label-up" style={{ color: STATUS_COLOR[s.status] }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[s.status] }} />
                    {STATUS_LABEL[s.status]}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#5C6B62]"><Building2 className="w-3.5 h-3.5" />{locations[s.local] || s.local}</div>
                </div>
                <div className="font-heading text-xl font-medium text-[#1F2924] mb-2">{s.utente_nome}</div>
                <div className="text-sm text-[#1F2924] mb-3"><strong>Motivo:</strong> {s.motivo}</div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div className="flex items-start gap-2">
                    <LogOut className="w-4 h-4 text-[#C26D5C] mt-0.5" />
                    <div>
                      <div className="text-xs text-[#5C6B62]">Saída</div>
                      <div className="text-[#1F2924] tabular-nums">{fmt(s.saida_prevista)}</div>
                      {s.saida_real && <div className="text-xs text-[#4A7C59]">Real: {fmt(s.saida_real)}</div>}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <LogIn className="w-4 h-4 text-[#4A7C59] mt-0.5" />
                    <div>
                      <div className="text-xs text-[#5C6B62]">Regresso</div>
                      <div className="text-[#1F2924] tabular-nums">{fmt(s.regresso_previsto)}</div>
                      {s.regresso_real && <div className="text-xs text-[#4A7C59]">Real: {fmt(s.regresso_real)}</div>}
                    </div>
                  </div>
                </div>
                {s.responsavel_nome && (
                  <div className="text-xs text-[#5C6B62] mb-3">Acompanhado por <strong className="text-[#1F2924]">{s.responsavel_nome}</strong>{s.responsavel_telefone && <> · <Phone className="inline w-3 h-3" /> {s.responsavel_telefone}</>}</div>
                )}
                {s.observacoes && <div className="text-xs text-[#5C6B62] mb-3 p-2 bg-[#F9F8F6] rounded">{s.observacoes}</div>}
                <div className="flex gap-2 flex-wrap">
                  {s.status === "agendada" && (
                    <button onClick={() => iniciar(s.saida_id)} className="btn-primary px-3 py-2 text-xs flex items-center gap-1" data-testid={`iniciar-${s.saida_id}`}><ArrowRight className="w-3.5 h-3.5" /> Saiu agora</button>
                  )}
                  {s.status === "em_curso" && (
                    <button onClick={() => regresso(s.saida_id)} className="btn-primary px-3 py-2 text-xs flex items-center gap-1" data-testid={`regressar-${s.saida_id}`}><Check className="w-3.5 h-3.5" /> Já regressou</button>
                  )}
                  {(s.status === "agendada" || s.status === "em_curso") && (
                    <button onClick={() => cancelar(s.saida_id)} className="btn-ghost px-3 py-2 text-xs flex items-center gap-1" data-testid={`cancelar-${s.saida_id}`}><X className="w-3.5 h-3.5" /> Cancelar</button>
                  )}
                  <button onClick={() => apagar(s.saida_id)} className="btn-ghost px-3 py-2 text-xs flex items-center gap-1 text-[#C26D5C]" data-testid={`apagar-${s.saida_id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
