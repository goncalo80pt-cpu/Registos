import React, { useEffect, useState } from "react";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Check, Building2 } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1773227059780-5e865ce7fb13?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxoYXBweSUyMGVsZGVybHklMjBjYXJlfGVufDB8fHx8MTc3Nzg4NTI5MXww&ixlib=rb-4.1.0&q=85";

export default function CheckinPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [local, setLocal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    visitante_nome: "",
    documento: "",
    telefone: "",
    pessoa_visitada: "",
    motivo: "",
    observacoes: "",
  });
  const [utentes, setUtentes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    api.get("/locations").then(r => setLocations(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!local) { setUtentes([]); return; }
    api.get("/utentes/public", { params: { local } })
      .then(r => setUtentes(r.data))
      .catch(() => setUtentes([]));
  }, [local]);

  const matches = (form.pessoa_visitada || "").trim().length >= 1
    ? utentes.filter(u => u.nome.toLowerCase().includes(form.pessoa_visitada.toLowerCase())).slice(0, 8)
    : utentes.slice(0, 8);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!local) {
      toast.error("Escolha o local da visita.");
      return;
    }
    if (!form.visitante_nome.trim() || !form.pessoa_visitada.trim() || !form.motivo.trim()) {
      toast.error("Preencha o seu nome, o nome do idoso e o motivo.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/visits/checkin", { ...form, instituicao: local });
      toast.success(`Entrada registada às ${new Date(res.data.entrada).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erro ao registar entrada");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" data-testid="checkin-page">
      <Header minimal />
      <main className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-90px)]">
        <div className="relative hidden lg:block overflow-hidden bg-[#1F2924]">
          <img src={HERO_IMG} alt="visita" className="absolute inset-0 w-full h-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#1F2924]/80 via-[#1F2924]/20 to-transparent" />
          <div className="relative z-10 h-full flex flex-col justify-end p-14 text-white">
            <div className="label-up text-white/80 mb-5">Centro Social de Brito</div>
            <h2 className="font-heading text-5xl font-light leading-tight max-w-md">
              Cada visita, um momento que importa.
            </h2>
          </div>
        </div>

        <div className="p-8 md:p-12 lg:p-20 fade-in-up">
          <div className="max-w-xl">
            <div className="label-up mb-4">Registo de entrada</div>
            <h1 className="font-heading text-4xl md:text-5xl font-light text-[#1F2924] mb-10">Vamos começar</h1>

            <div className="mb-10">
              <div className="label-up mb-4">Local da visita</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {locations.map(loc => (
                  <button
                    key={loc.key}
                    type="button"
                    onClick={() => setLocal(loc.key)}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${local === loc.key ? "border-[#4A7C59] bg-[#F1F2F0]" : "border-[#E5E7E2] hover:border-[#4A7C59]/60"}`}
                    data-testid={`select-local-${loc.key}`}
                  >
                    <Building2 className={`w-6 h-6 mb-2 ${local === loc.key ? "text-[#4A7C59]" : "text-[#5C6B62]"}`} />
                    <div className="font-heading text-lg font-medium leading-tight">{loc.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={submit} className="space-y-6" data-testid="checkin-form">
              <div>
                <label className="label-up mb-2 block">O seu nome *</label>
                <input className="input-kiosk" value={form.visitante_nome} onChange={update("visitante_nome")} placeholder="Ex: Maria Silva" data-testid="input-nome" />
              </div>

              <div>
                <label className="label-up mb-2 block">Nome do idoso *</label>
                <div className="relative">
                  <input
                    className="input-kiosk"
                    value={form.pessoa_visitada}
                    onChange={(e) => { setForm({ ...form, pessoa_visitada: e.target.value }); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder={local ? "Comece a escrever o nome..." : "Escolha primeiro o local"}
                    disabled={!local}
                    data-testid="input-visitado"
                    autoComplete="off"
                  />
                  {showSuggestions && local && matches.length > 0 && (
                    <ul className="absolute left-0 right-0 mt-1 bg-white border border-[#E5E7E2] rounded-lg shadow-xl max-h-72 overflow-y-auto z-30" data-testid="visitado-suggestions">
                      {matches.map((u) => (
                        <li
                          key={u.utente_id}
                          onMouseDown={(e) => { e.preventDefault(); setForm({ ...form, pessoa_visitada: u.nome }); setShowSuggestions(false); }}
                          className="px-4 py-3 cursor-pointer hover:bg-[#F1F2F0] text-[#1F2924] border-b border-[#F1F2F0] last:border-0"
                          data-testid={`suggest-${u.utente_id}`}
                        >
                          {u.nome}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <label className="label-up mb-2 block">Motivo *</label>
                <input className="input-kiosk" value={form.motivo} onChange={update("motivo")} placeholder="Ex: Visita familiar" data-testid="input-motivo" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label-up mb-2 block">Documento</label>
                  <input className="input-kiosk" value={form.documento} onChange={update("documento")} placeholder="CC / BI" data-testid="input-documento" />
                </div>
                <div>
                  <label className="label-up mb-2 block">Telefone</label>
                  <input className="input-kiosk" value={form.telefone} onChange={update("telefone")} placeholder="9XX XXX XXX" data-testid="input-telefone" />
                </div>
              </div>

              <div>
                <label className="label-up mb-2 block">Observações</label>
                <textarea rows={3} value={form.observacoes} onChange={update("observacoes")} className="input-kiosk" style={{ height: "auto", paddingTop: "1rem", paddingBottom: "1rem" }} placeholder="Alguma nota adicional..." data-testid="input-observacoes" />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => navigate("/")} className="btn-ghost px-8 py-5" data-testid="btn-cancelar">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary px-10 py-5 flex items-center gap-3 flex-1 justify-center text-lg disabled:opacity-60" data-testid="btn-confirmar-entrada">
                  <Check className="w-6 h-6" />
                  {submitting ? "A registar..." : "Confirmar entrada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
