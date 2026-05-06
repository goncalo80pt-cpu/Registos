import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import { api, API } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Search, Download, Calendar, Building2, Filter, Printer } from "lucide-react";
import { toast } from "sonner";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function duration(a, b) {
  if (!b) return "em curso";
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  const h = Math.floor(d / 60); const m = d % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`;
}

const SAIDA_STATUS_LABEL = { agendada: "Agendada", em_curso: "Em curso", concluida: "Concluída", cancelada: "Cancelada" };
const SAIDA_STATUS_COLOR = { agendada: "#4A7C59", em_curso: "#C26D5C", concluida: "#5C6B62", cancelada: "#9aa39c" };

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState("visitas"); // "visitas" | "saidas"
  const [nome, setNome] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [rows, setRows] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [locations, setLocations] = useState([]);
  const locMap = locations.reduce((m, l) => ({ ...m, [l.key]: l.label }), {});

  const load = useCallback(async () => {
    setFetching(true);
    try {
      let dataRows = [];
      const ls = await api.get("/locations");
      setLocations(ls.data);
      if (tipo === "visitas") {
        const params = {};
        if (nome) params.nome = nome;
        if (instituicao) params.instituicao = instituicao;
        if (dataInicio) params.data_inicio = dataInicio;
        if (dataFim) params.data_fim = dataFim;
        const res = await api.get("/visits/history", { params });
        dataRows = res.data;
      } else {
        // Saídas: fetch all (any status) and filter client-side by name/dates/local
        const res = await api.get("/saidas", { params: { status: "todas" } });
        dataRows = res.data || [];
        if (instituicao) dataRows = dataRows.filter(s => s.local === instituicao);
        if (nome) {
          const n = nome.toLowerCase();
          dataRows = dataRows.filter(s => (s.utente_nome || "").toLowerCase().includes(n));
        }
        if (dataInicio) {
          const start = new Date(dataInicio + "T00:00:00").getTime();
          dataRows = dataRows.filter(s => new Date(s.saida_prevista).getTime() >= start);
        }
        if (dataFim) {
          const end = new Date(dataFim + "T23:59:59").getTime();
          dataRows = dataRows.filter(s => new Date(s.saida_prevista).getTime() <= end);
        }
        dataRows.sort((a, b) => new Date(b.saida_prevista) - new Date(a.saida_prevista));
      }
      setRows(dataRows);
    } catch (e) {
      toast.error("Erro a carregar histórico");
    } finally {
      setFetching(false);
    }
  }, [tipo, nome, instituicao, dataInicio, dataFim]);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) { navigate("/login?next=/historico", { replace: true }); return; }
    load();
  }, [user, loading, load, navigate]);

  const exportCsv = async () => {
    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch(`${API}/visits/export`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "historico_visitas.csv";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Histórico exportado");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  return (
    <div className="min-h-screen" data-testid="history-page">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-10 md:py-14 fade-in-up">
        <div className="hidden print:block mb-6 text-center" data-testid="print-header">
          <div className="text-xs uppercase tracking-widest text-gray-600">Centro Social de Brito</div>
          <div className="font-heading text-2xl font-light mt-1">{tipo === "visitas" ? "Histórico de visitas" : "Histórico de saídas dos utentes"}</div>
          <div className="text-xs text-gray-700 mt-1">Impresso em {new Date().toLocaleDateString("pt-PT")} · {rows.length} registo(s)</div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6 print:hidden">
          <div>
            <div className="label-up mb-3">Histórico</div>
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-light text-[#1F2924]">Todos os registos</h1>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <button onClick={() => window.print()} className="btn-ghost px-4 py-3 flex items-center gap-2 text-sm" data-testid="print-history-btn">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            {tipo === "visitas" && (
              <button onClick={exportCsv} className="btn-primary px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 text-sm sm:text-base shrink-0" data-testid="export-csv-btn">
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="whitespace-nowrap">Exportar CSV</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6 print:hidden" role="tablist" data-testid="tipo-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tipo === "visitas"}
            onClick={() => { setTipo("visitas"); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${tipo === "visitas" ? "bg-[#4A7C59] text-white" : "bg-[#F1F2F0] text-[#5C6B62] hover:bg-[#E5E7E2]"}`}
            data-testid="tab-visitas"
          >
            Visitas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tipo === "saidas"}
            onClick={() => { setTipo("saidas"); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${tipo === "saidas" ? "bg-[#4A7C59] text-white" : "bg-[#F1F2F0] text-[#5C6B62] hover:bg-[#E5E7E2]"}`}
            data-testid="tab-saidas"
          >
            Saídas
          </button>
        </div>

        <div className="card-crisp p-6 md:p-8 mb-6 print:hidden" data-testid="filters-card">
          <div className="flex items-center gap-2 mb-5 text-[#5C6B62]">
            <Filter className="w-4 h-4" />
            <span className="label-up">Filtros</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label-up mb-2 block">{tipo === "visitas" ? "Nome do visitante" : "Nome do utente"}</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B62]" />
                <input className="input-kiosk pl-11 !h-12 !text-base" style={{height:'3rem', fontSize:'1rem'}} value={nome} onChange={e=>setNome(e.target.value)} placeholder={tipo === "visitas" ? "Visitante..." : "Utente..."} data-testid="filter-nome" />
              </div>
            </div>
            <div>
              <label className="label-up mb-2 block">Local</label>
              <select className="input-kiosk !h-12 !text-base" style={{height:'3rem', fontSize:'1rem'}} value={instituicao} onChange={e=>setInstituicao(e.target.value)} data-testid="filter-instituicao">
                <option value="">Todos</option>
                {locations.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-up mb-2 block">Data início</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B62] pointer-events-none" />
                <input type="date" className="input-kiosk pl-11 !h-12 !text-base" style={{height:'3rem', fontSize:'1rem'}} value={dataInicio} onChange={e=>setDataInicio(e.target.value)} data-testid="filter-data-inicio" />
              </div>
            </div>
            <div>
              <label className="label-up mb-2 block">Data fim</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B62] pointer-events-none" />
                <input type="date" className="input-kiosk pl-11 !h-12 !text-base" style={{height:'3rem', fontSize:'1rem'}} value={dataFim} onChange={e=>setDataFim(e.target.value)} data-testid="filter-data-fim" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={load} className="btn-primary px-5 py-3 text-sm" data-testid="apply-filters">Aplicar filtros</button>
            <button onClick={() => { setNome(""); setInstituicao(""); setDataInicio(""); setDataFim(""); setTimeout(load, 0); }} className="btn-ghost px-5 py-3 text-sm" data-testid="clear-filters">Limpar</button>
          </div>
        </div>

        <div className="card-crisp overflow-hidden" data-testid="history-table-card">
          {fetching ? (
            <div className="p-16 text-center text-[#5C6B62]">A carregar...</div>
          ) : rows.length === 0 ? (
            <div className="p-16 text-center text-[#5C6B62]" data-testid="history-empty">Nenhum registo para os filtros selecionados.</div>
          ) : tipo === "visitas" ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="history-table">
                <thead>
                  <tr className="text-left border-b border-[#E5E7E2] bg-[#F9F8F6]">
                    <th className="label-up p-4">Local</th>
                    <th className="label-up p-4">Visitante</th>
                    <th className="label-up p-4">Visita a</th>
                    <th className="label-up p-4">Motivo</th>
                    <th className="label-up p-4">Entrada</th>
                    <th className="label-up p-4">Saída</th>
                    <th className="label-up p-4">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const localLabel = locMap[r.instituicao] || r.instituicao;
                    return (
                      <tr key={r.visit_id} className="border-b border-[#E5E7E2] last:border-0 hover:bg-[#F9F8F6] transition" data-testid={`history-row-${r.visit_id}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm text-[#4A7C59]">
                            <Building2 className="w-4 h-4" />
                            <span>{localLabel}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-[#1F2924]">{r.visitante_nome}</div>
                          <div className="text-xs text-[#5C6B62]">{r.telefone || "—"}</div>
                        </td>
                        <td className="p-4 text-[#1F2924]">{r.pessoa_visitada}</td>
                        <td className="p-4 text-[#5C6B62] text-sm max-w-xs truncate">{r.motivo}</td>
                        <td className="p-4 text-sm tabular-nums text-[#1F2924]">{fmtDate(r.entrada)}</td>
                        <td className="p-4 text-sm tabular-nums text-[#1F2924]">{fmtDate(r.saida)}</td>
                        <td className="p-4 text-sm text-[#5C6B62]">{duration(r.entrada, r.saida)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="saidas-history-table">
                <thead>
                  <tr className="text-left border-b border-[#E5E7E2] bg-[#F9F8F6]">
                    <th className="label-up p-4">Local</th>
                    <th className="label-up p-4">Utente</th>
                    <th className="label-up p-4">Motivo</th>
                    <th className="label-up p-4">Saída prevista</th>
                    <th className="label-up p-4">Regresso previsto</th>
                    <th className="label-up p-4">Acompanhante</th>
                    <th className="label-up p-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => {
                    const localLabel = locMap[s.local] || s.local;
                    const statusLbl = SAIDA_STATUS_LABEL[s.status] || s.status;
                    const statusColor = SAIDA_STATUS_COLOR[s.status] || "#5C6B62";
                    return (
                      <tr key={s.saida_id} className="border-b border-[#E5E7E2] last:border-0 hover:bg-[#F9F8F6] transition" data-testid={`saida-row-${s.saida_id}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm text-[#4A7C59]">
                            <Building2 className="w-4 h-4" />
                            <span>{localLabel}</span>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-[#1F2924]">{s.utente_nome}</td>
                        <td className="p-4 text-[#5C6B62] text-sm max-w-xs truncate">{s.motivo}</td>
                        <td className="p-4 text-sm tabular-nums text-[#1F2924]">
                          <div>{fmtDate(s.saida_prevista)}</div>
                          {s.saida_real && <div className="text-xs text-[#4A7C59]">Real: {fmtDate(s.saida_real)}</div>}
                        </td>
                        <td className="p-4 text-sm tabular-nums text-[#1F2924]">
                          <div>{fmtDate(s.regresso_previsto)}</div>
                          {s.regresso_real && <div className="text-xs text-[#4A7C59]">Real: {fmtDate(s.regresso_real)}</div>}
                        </td>
                        <td className="p-4 text-sm text-[#5C6B62]">
                          {s.responsavel_nome || "—"}
                          {s.responsavel_telefone && <div className="text-xs">{s.responsavel_telefone}</div>}
                        </td>
                        <td className="p-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: `${statusColor}1a`, color: statusColor }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                            {statusLbl}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-[#5C6B62]" data-testid="history-count">{rows.length} registo(s)</div>
      </main>
    </div>
  );
}
