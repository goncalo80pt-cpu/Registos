import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { CalendarDays, Check, Building2, Clock, AlertCircle } from "lucide-react";

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export default function BookingPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [local, setLocal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    visitante_nome: "",
    telefone: "",
    pessoa_visitada: "",
    data: todayPlusDays(1),
    observacoes: "",
  });
  const [slot, setSlot] = useState(null); // "HH:MM"
  const [availability, setAvailability] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    api.get("/locations").then(r => setLocations(r.data)).catch(() => {});
  }, []);

  const loadAvailability = useCallback(async () => {
    if (!local || !form.data) { setAvailability(null); return; }
    setLoadingSlots(true);
    setSlot(null);
    try {
      const res = await api.get("/bookings/availability", { params: { date: form.data, local } });
      setAvailability(res.data);
    } catch {
      setAvailability(null);
      toast.error("Erro a carregar horários disponíveis");
    } finally {
      setLoadingSlots(false);
    }
  }, [local, form.data]);

  useEffect(() => { loadAvailability(); }, [loadAvailability]);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!local) { toast.error("Escolha o local da visita."); return; }
    if (!form.visitante_nome.trim() || !form.pessoa_visitada.trim()) {
      toast.error("Preencha o seu nome e o nome do idoso."); return;
    }
    if (!slot) { toast.error("Escolha um horário disponível."); return; }

    const dataHora = new Date(`${form.data}T${slot}:00`);
    if (isNaN(dataHora.getTime())) { toast.error("Data/hora inválida."); return; }

    setSubmitting(true);
    try {
      const res = await api.post("/bookings", {
        visitante_nome: form.visitante_nome,
        telefone: form.telefone,
        pessoa_visitada: form.pessoa_visitada,
        local,
        data_hora: dataHora.toISOString(),
        observacoes: form.observacoes,
      });
      const dt = new Date(res.data.data_hora);
      toast.success(`Visita marcada para ${dt.toLocaleDateString("pt-PT")} às ${dt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`);
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Erro ao marcar visita";
      toast.error(msg);
      if (err?.response?.status === 409) loadAvailability();
    } finally {
      setSubmitting(false);
    }
  };

  const dateObj = form.data ? new Date(form.data + "T12:00:00") : null;
  const weekday = dateObj ? WEEKDAYS_PT[dateObj.getDay()] : "";

  return (
    <div className="min-h-screen" data-testid="booking-page">
      <Header />
      <main className="max-w-3xl mx-auto px-6 md:px-10 py-10 md:py-16 fade-in-up">
        <div className="mb-10">
          <div className="label-up mb-4">Marcar visita</div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-[#1F2924] mb-3">Agendar uma visita ao idoso</h1>
          <p className="text-lg text-[#5C6B62]">Escolha o local, o dia e o horário disponível.</p>
        </div>

        <form onSubmit={submit} className="card-crisp p-8 md:p-10 space-y-7" data-testid="booking-form">
          <div>
            <div className="label-up mb-3">Local</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {locations.map(loc => (
                <button
                  key={loc.key}
                  type="button"
                  onClick={() => setLocal(loc.key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${local === loc.key ? "border-[#4A7C59] bg-[#F1F2F0]" : "border-[#E5E7E2] hover:border-[#4A7C59]/60"}`}
                  data-testid={`booking-local-${loc.key}`}
                >
                  <Building2 className={`w-5 h-5 mb-2 ${local === loc.key ? "text-[#4A7C59]" : "text-[#5C6B62]"}`} />
                  <div className="font-heading font-medium leading-tight">{loc.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-up mb-2 block">Dia *</label>
            <div className="relative max-w-xs">
              <CalendarDays className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B62] pointer-events-none" />
              <input type="date" min={todayPlusDays(0)} className="input-kiosk pl-12" value={form.data} onChange={update("data")} data-testid="booking-data" />
            </div>
            {weekday && <div className="text-sm text-[#5C6B62] mt-2 capitalize">{weekday}</div>}
          </div>

          <div>
            <div className="label-up mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Horários disponíveis</div>
            {!local ? (
              <div className="p-6 rounded-xl bg-[#F9F8F6] text-[#5C6B62] text-sm flex items-center gap-2" data-testid="slots-hint">
                <AlertCircle className="w-4 h-4" /> Escolha primeiro o local para ver os horários.
              </div>
            ) : loadingSlots ? (
              <div className="p-6 text-[#5C6B62] text-sm">A carregar horários...</div>
            ) : availability ? (
              <>
                {availability.afternoon_only && (
                  <div className="text-sm text-[#C26D5C] mb-3 p-3 bg-[#FAEFEB] rounded-md">
                    À segunda e sexta-feira só há visitas a partir das 14:00.
                  </div>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2" data-testid="slot-grid">
                  {availability.slots.map(s => {
                    const disabled = s.ocupada || s.passada;
                    const selected = slot === s.hora;
                    return (
                      <button
                        key={s.hora}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSlot(s.hora)}
                        className={`px-3 py-3 rounded-lg text-sm font-medium border transition-all ${
                          selected
                            ? "bg-[#4A7C59] text-white border-[#4A7C59]"
                            : disabled
                            ? "bg-[#F1F2F0] text-[#9aa39c] border-[#E5E7E2] line-through cursor-not-allowed"
                            : "bg-white text-[#1F2924] border-[#E5E7E2] hover:border-[#4A7C59] hover:bg-[#F1F2F0]"
                        }`}
                        data-testid={`slot-${s.hora}`}
                        title={s.ocupada ? "Já ocupado" : s.passada ? "Já passou" : `${s.hora} – ${s.hora_fim}`}
                      >
                        {s.hora}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-[#5C6B62]" data-testid="slots-legend">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white border border-[#E5E7E2]" /> Disponível</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#4A7C59]" /> Selecionado</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#F1F2F0]" /> Ocupado</span>
                </div>
              </>
            ) : null}
          </div>

          <div>
            <label className="label-up mb-2 block">O seu nome *</label>
            <input className="input-kiosk" value={form.visitante_nome} onChange={update("visitante_nome")} placeholder="Ex: Maria Silva" data-testid="booking-nome" />
          </div>

          <div>
            <label className="label-up mb-2 block">Nome do idoso *</label>
            <input className="input-kiosk" value={form.pessoa_visitada} onChange={update("pessoa_visitada")} placeholder="Ex: Sr. António" data-testid="booking-visitado" />
          </div>

          <div>
            <label className="label-up mb-2 block">Telefone</label>
            <input className="input-kiosk" value={form.telefone} onChange={update("telefone")} placeholder="9XX XXX XXX" data-testid="booking-telefone" />
          </div>

          <div>
            <label className="label-up mb-2 block">Observações</label>
            <textarea rows={3} value={form.observacoes} onChange={update("observacoes")} className="input-kiosk" style={{ height: "auto", paddingTop: "1rem", paddingBottom: "1rem" }} placeholder="Alguma nota adicional..." data-testid="booking-observacoes" />
          </div>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => navigate("/")} className="btn-ghost px-8 py-5" data-testid="booking-cancel">Cancelar</button>
            <button type="submit" disabled={submitting || !slot} className="btn-primary px-10 py-5 flex items-center gap-3 flex-1 justify-center text-lg disabled:opacity-60" data-testid="booking-submit">
              <Check className="w-6 h-6" />
              {submitting ? "A marcar..." : slot ? `Confirmar — ${slot}` : "Confirmar marcação"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
