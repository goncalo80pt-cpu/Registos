import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../lib/auth";
import { LogIn, LogOut, ShieldCheck, ArrowRight, Heart, History } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const goHistorico = () => {
    if (user?.is_admin) navigate("/historico");
    else navigate("/login?next=/historico");
  };

  return (
    <div className="min-h-screen" data-testid="home-page">
      <Header />

      <main className="max-w-7xl mx-auto px-6 md:px-10 pt-10 md:pt-20 pb-24">
        <section className="grid grid-cols-12 gap-8 items-end mb-16 fade-in-up">
          <div className="col-span-12 lg:col-span-8">
            <div className="label-up mb-5" data-testid="home-eyebrow">Registo digital de visitas</div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl tracking-tight font-light text-[#1F2924] leading-[1.05]">
              Centro<br />
              Social<br />
              <span className="text-[#4A7C59]">de Brito</span>
            </h1>
          </div>
          <div className="col-span-12 lg:col-span-4 text-lg md:text-xl leading-relaxed text-[#5C6B62] lg:pb-3">
            Uma forma simples e calma de registar quem visita os nossos idosos e quem vem buscar as nossas crianças — em segundos, num tablet.
          </div>
        </section>

        {/* Main action tiles */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
          <Link to="/entrada" className="group card-crisp p-10 md:p-12 transition-all hover:-translate-y-1 hover:shadow-lg fade-in-up stagger-1" data-testid="tile-entrada">
            <div className="flex items-start justify-between mb-10">
              <div className="w-16 h-16 rounded-2xl bg-[#4A7C59] text-white flex items-center justify-center">
                <LogIn className="w-8 h-8" />
              </div>
              <ArrowRight className="w-7 h-7 text-[#5C6B62] group-hover:translate-x-2 group-hover:text-[#4A7C59] transition-all" />
            </div>
            <div className="label-up mb-3">Passo 1</div>
            <h2 className="font-heading text-4xl md:text-5xl font-medium text-[#1F2924] mb-4">Entrada</h2>
            <p className="text-lg text-[#5C6B62] leading-relaxed">Registe a hora de chegada, quem vem visitar e para quem é a visita.</p>
          </Link>

          <Link to="/saida" className="group card-crisp p-10 md:p-12 transition-all hover:-translate-y-1 hover:shadow-lg fade-in-up stagger-2" data-testid="tile-saida">
            <div className="flex items-start justify-between mb-10">
              <div className="w-16 h-16 rounded-2xl bg-[#C26D5C] text-white flex items-center justify-center">
                <LogOut className="w-8 h-8" />
              </div>
              <ArrowRight className="w-7 h-7 text-[#5C6B62] group-hover:translate-x-2 group-hover:text-[#C26D5C] transition-all" />
            </div>
            <div className="label-up mb-3">Ao terminar</div>
            <h2 className="font-heading text-4xl md:text-5xl font-medium text-[#1F2924] mb-4">Saída</h2>
            <p className="text-lg text-[#5C6B62] leading-relaxed">Um toque para registar a hora de saída de quem está dentro.</p>
          </Link>
        </section>

        {/* Secondary features */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button onClick={goHistorico} className="card-crisp p-8 hover:-translate-y-1 transition-all fade-in-up stagger-3 text-left" data-testid="tile-historico">
            <History className="w-7 h-7 text-[#4A7C59] mb-4" />
            <div className="label-up mb-2">Histórico</div>
            <p className="text-[#1F2924] font-heading text-xl mb-3">Ver todos os registos anteriores.</p>
            <span className="text-sm text-[#5C6B62]">Guardado durante 1 ano · acesso protegido →</span>
          </button>
          <div className="card-crisp p-8 fade-in-up stagger-3" data-testid="feat-simples">
            <Heart className="w-6 h-6 text-[#C26D5C] mb-4" />
            <div className="label-up mb-2">Simples</div>
            <p className="text-[#1F2924] font-heading text-xl">Grandes botões, letras legíveis — pensado para todas as idades.</p>
          </div>
          <Link to="/login" className="card-crisp p-8 hover:-translate-y-1 transition-all fade-in-up stagger-4" data-testid="feat-admin">
            <ShieldCheck className="w-6 h-6 text-[#4A7C59] mb-4" />
            <div className="label-up mb-2">Administração</div>
            <p className="text-[#1F2924] font-heading text-xl">Dashboard com estatísticas e exportação de histórico em CSV.</p>
          </Link>
        </section>
      </main>
    </div>
  );
}
