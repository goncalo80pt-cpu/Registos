import React from "react";
import Header from "../components/Header";
import { Phone, Clock, ScrollText, Info } from "lucide-react";

const REGULATION_RULES = [
  "As visitas devem ser agendadas previamente, entre as 09h00 e as 18h00, por telefone (ERPI Brito – 253 572 414; ERPI Polo do Paraíso e Lar Residencial – 253 084 588).",
  "As visitas decorrem de segunda a sexta das 10h00 às 11h30 e das 14h00 às 18h30 (nas segundas, sextas, sábados e domingos não são permitidas visitas no período da manhã).",
  "Aos sábados, domingos e feriados as visitas decorrem das 14h00 às 17h30.",
  "Não existe limite à marcação de visitas por semana.",
  "No registo das visitas consta o Nome do Visitante, Nome do Utente e Hora da Visita.",
  "Os pedidos de visitas num horário diferente do disponibilizado serão analisados caso a caso.",
  "A marcação de visitas deve ser realizada, preferencialmente, pelo responsável do utente.",
  "Para garantir o direito de visitas a todos os residentes, estas poderão estar sujeitas a um período máximo de 30 minutos.",
  "As visitas devem comparecer 10 min antes da hora marcada.",
  "As visitas decorrem com um máximo de 4 pessoas por marcação.",
  "As visitas são realizadas em local próprio, devidamente indicado pela equipa.",
  "Qualquer visita desmarcada deverá ser comunicada, com a maior brevidade possível para beneficiar outro utente.",
  "O visitante deve higienizar as mãos antes e após o período de visitas e sempre que necessário.",
  "Visitantes com febre, tosse e dificuldades respiratórias não devem comparecer na visita, mesmo que já agendada.",
  "São permitidas as visitas nos quartos apenas em caso de utentes que se encontrem acamados e que permaneçam exclusivamente nos seus quartos, de modo a promover a segurança dos intervenientes.",
  "Sempre que a equipa considerar necessário, pode ser solicitada a retirada das visitas do quarto para a prestação de cuidados ao utente.",
];

export default function HomePage() {
  return (
    <div className="min-h-screen" data-testid="home-page">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 pt-6 sm:pt-10 md:pt-20 pb-16 sm:pb-24">
        <section className="grid grid-cols-12 gap-8 items-center mb-16 fade-in-up">
          <div className="col-span-12 lg:col-span-7">
            <div className="label-up mb-5" data-testid="home-eyebrow">Registo digital de visitas</div>
            <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl tracking-tight font-light text-[#1F2924] leading-[1.05]">
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

        <section className="card-crisp p-6 sm:p-10 md:p-14 fade-in-up" data-testid="regulation-section">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#4A7C59]/10 flex items-center justify-center text-[#4A7C59] shrink-0">
              <ScrollText className="w-6 h-6" />
            </div>
            <div>
              <div className="label-up mb-1">DG 01.23</div>
              <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-light text-[#1F2924] leading-tight">
                Regulamento de visitas
              </h2>
              <p className="text-sm text-[#5C6B62] mt-1">ERPI's e Lar Residencial</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl bg-[#F1F2F0] p-4 flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#4A7C59] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="label-up text-[10px] mb-1">ERPI Brito</div>
                <a href="tel:+351253572414" className="font-heading text-lg text-[#1F2924] tabular-nums hover:text-[#4A7C59]" data-testid="phone-brito">253 572 414</a>
              </div>
            </div>
            <div className="rounded-xl bg-[#F1F2F0] p-4 flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#4A7C59] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="label-up text-[10px] mb-1">Pólo do Paraíso e Lar Residencial</div>
                <a href="tel:+351253084588" className="font-heading text-lg text-[#1F2924] tabular-nums hover:text-[#4A7C59]" data-testid="phone-paraiso">253 084 588</a>
              </div>
            </div>
            <div className="rounded-xl bg-[#F1F2F0] p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#4A7C59] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="label-up text-[10px] mb-1">Marcação por telefone</div>
                <div className="font-heading text-lg text-[#1F2924] tabular-nums">09h00 — 18h00</div>
              </div>
            </div>
          </div>

          <ol className="space-y-4" data-testid="regulation-list">
            {REGULATION_RULES.map((rule, i) => (
              <li key={i} className="flex gap-4 items-start" data-testid={`regulation-rule-${i + 1}`}>
                <div className="w-7 h-7 rounded-full bg-[#4A7C59] text-white text-xs font-semibold flex items-center justify-center tabular-nums shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-[#1F2924] leading-relaxed text-sm sm:text-base">{rule}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-[#FAEFEB] border border-[#E8C9C0]">
            <Info className="w-5 h-5 text-[#C26D5C] mt-0.5 shrink-0" />
            <p className="text-sm text-[#1F2924] leading-relaxed">
              O cumprimento destas regras garante a segurança e o bem-estar de todos os residentes. Agradecemos a sua colaboração.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
