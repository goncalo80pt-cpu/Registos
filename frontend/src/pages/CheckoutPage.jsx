import React, { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import { api } from "../lib/api";
import { toast } from "sonner";
import { LogOut, Clock, Baby, HeartHandshake, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

function timeSince(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `há ${h}h${m.toString().padStart(2, "0")}`;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/visits/active");
      setList(res.data);
    } catch (e) {
      toast.error("Erro a carregar visitantes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const doCheckout = async (id) => {
    try {
      const res = await api.post(`/visits/${id}/checkout`);
      toast.success(`Saída registada às ${new Date(res.data.saida).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`);
      setConfirmId(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao registar saída");
    }
  };

  const filtered = list.filter(v => {
    const s = filter.toLowerCase();
    return !s || v.visitante_nome.toLowerCase().includes(s) || v.pessoa_visitada.toLowerCase().includes(s);
  });

  return (
    <div className="min-h-screen" data-testid="checkout-page">
      <Header minimal />
      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-16 fade-in-up">
        <div className="mb-10">
          <div className="label-up mb-4">Registo de saída</div>
          <h1 className="font-heading text-4xl md:text-6xl font-light text-[#1F2924] mb-4">Quem está dentro</h1>
          <p className="text-lg text-[#5C6B62]">Toque em “Sair” no seu nome para registar a hora de saída.</p>
        </div>

        <div className="relative mb-8">
          <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-[#5C6B62]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Pesquisar pelo seu nome ou pela pessoa visitada..."
            className="input-kiosk pl-14"
            data-testid="search-active"
          />
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#5C6B62]" data-testid="loading-state">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="card-crisp p-16 text-center" data-testid="empty-state">
            <Clock className="w-12 h-12 mx-auto text-[#5C6B62] mb-4" />
            <h2 className="font-heading text-2xl text-[#1F2924] mb-2">Não há visitantes dentro</h2>
            <p className="text-[#5C6B62]">Quando alguém fizer check-in, aparecerá aqui.</p>
            <button onClick={() => navigate("/entrada")} className="btn-primary px-8 py-4 mt-8" data-testid="btn-ir-entrada">Registar entrada</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="active-list">
            {filtered.map((v) => {
              const isCreche = v.instituicao === "creche";
              const Icon = isCreche ? Baby : HeartHandshake;
              const color = isCreche ? "#4A7C59" : "#C26D5C";
              return (
                <div key={v.visit_id} className="card-crisp p-7 flex items-start justify-between gap-4" data-testid={`active-item-${v.visit_id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 label-up mb-3" style={{ color }}>
                      <Icon className="w-4 h-4" />
                      <span>{isCreche ? "Creche" : "Lar de Idosos"}</span>
                    </div>
                    <div className="font-heading text-2xl font-medium text-[#1F2924] mb-1 truncate">{v.visitante_nome}</div>
                    <div className="text-[#5C6B62] text-sm mb-3">
                      {isCreche ? "veio buscar" : "veio visitar"} <span className="text-[#1F2924] font-medium">{v.pessoa_visitada}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#5C6B62]">
                      <Clock className="w-3.5 h-3.5" />
                      Entrou às {new Date(v.entrada).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} · {timeSince(v.entrada)}
                    </div>
                  </div>
                  {confirmId === v.visit_id ? (
                    <div className="flex flex-col gap-2">
                      <button onClick={() => doCheckout(v.visit_id)} className="btn-secondary px-5 py-3 text-sm" data-testid={`confirm-checkout-${v.visit_id}`}>Confirmar</button>
                      <button onClick={() => setConfirmId(null)} className="btn-ghost px-5 py-2 text-xs">Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(v.visit_id)} className="btn-secondary px-6 py-4 flex items-center gap-2 shrink-0" data-testid={`checkout-btn-${v.visit_id}`}>
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
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
