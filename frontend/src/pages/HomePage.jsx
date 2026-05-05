import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAuth } from "../lib/auth";
import { ShieldCheck, ArrowRight, History, CalendarPlus } from "lucide-react";

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
        <section className="grid grid-cols-12 gap-8 items-center mb-16 fade-in-up">
          <div className="col-span-12 lg:col-span-7">
            <div className="label-up mb-5" data-testid="home-eyebrow">Registo digital de visitas</div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl tracking-tight font-light text-[#1F2924] leading-[1.05]">
              Centro<br />
              Social<br />
              <span className="text-[#4A7C59]">de Brito</span>
            </h1>
          </div>
          <div className="col-span-12 lg:col-span-5 flex justify-center lg:justify-end">
            <img
              src="https://customer-assets.emergentagent.com/job_visitor-log-26/artifacts/1baaekq5_LogoCS_Retina.jpg"
              alt="Centro Social de Brito — Instituição Particular de Solidariedade Social"
              className="w-64 sm:w-80 lg:w-[22rem] h-auto"
              data-testid="home-logo"
            />
          </div>
        </section>

        {/* Main action tile */}
        <section className="grid grid-cols-1 mb-8">
          <Link to="/marcar" className="group card-crisp p-10 md:p-14 transition-all hover:-translate-y-1 hover:shadow-lg fade-in-up stagger-1" data-testid="tile-marcar">
            <div className="flex items-start justify-between mb-8">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-[#1F2924] text-white flex items-center justify-center">
                <CalendarPlus className="w-8 h-8 md:w-10 md:h-10" />
              </div>
              <ArrowRight className="w-7 h-7 text-[#5C6B62] group-hover:translate-x-2 group-hover:text-[#1F2924] transition-all" />
            </div>
            <div className="label-up mb-3">Antes da visita</div>
            <h2 className="font-heading text-4xl md:text-5xl font-medium text-[#1F2924] mb-3">Marcar visita</h2>
            <p className="text-base md:text-lg text-[#5C6B62] leading-relaxed max-w-2xl">Escolha o dia e a hora para visitar o seu familiar.</p>
          </Link>
        </section>

        {/* Secondary features */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={goHistorico} className="card-crisp p-8 hover:-translate-y-1 transition-all fade-in-up stagger-3 text-left" data-testid="tile-historico">
            <History className="w-7 h-7 text-[#4A7C59] mb-4" />
            <div className="label-up mb-2">Histórico</div>
            <p className="text-[#1F2924] font-heading text-xl mb-3">Ver todos os registos anteriores.</p>
            <span className="text-sm text-[#5C6B62]">Guardado durante 1 ano · acesso protegido →</span>
          </button>
          <Link to="/login" className="card-crisp p-8 hover:-translate-y-1 transition-all fade-in-up stagger-4" data-testid="feat-admin">
            <ShieldCheck className="w-7 h-7 text-[#4A7C59] mb-4" />
            <div className="label-up mb-2">Administração</div>
            <p className="text-[#1F2924] font-heading text-xl mb-3">Dashboard, marcações e exportação CSV.</p>
            <span className="text-sm text-[#5C6B62]">Entrar com nome e palavra-passe →</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
