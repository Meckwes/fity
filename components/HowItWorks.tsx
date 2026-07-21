"use client";
import { MessageSquare, ListChecks, Sparkles } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: MessageSquare,
    title: "Você fala sobre você",
    body: "Em 5 minutos, uma conversa rápida no Zap: objetivo, peso, rotina, restrições. Sem formulário gigante.",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "A IA monta seu plano",
    body: "A IA gera um plano alimentar + treino personalizado para você, usando comida brasileira e equipamento que você tem.",
  },
  {
    n: "03",
    icon: ListChecks,
    title: "Você recebe todo dia",
    body: "Briefing às 7h no WhatsApp. Lista de compras todo sábado. Substitui, ajusta, adapta — sem você pensar em nada.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="section-pad">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="eyebrow">Como funciona</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">
            3 passos. <span className="text-green-600">Sem planilha.</span>
          </h2>
          <p className="mt-4 text-ink-500">
            Setup em 5 minutos. A partir daí, é só abrir o Zap.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-12 left-[16.6%] right-[16.6%] h-0.5 bg-gradient-to-r from-green-300 via-green-500 to-green-300 -z-10" />

          {steps.map((s, i) => (
            <div key={i} className="text-center">
              <div className="w-24 h-24 rounded-3xl bg-green-50 border-2 border-green-200 mx-auto flex items-center justify-center mb-5">
                <s.icon size={36} className="text-green-600" />
              </div>
              <div className="text-xs font-bold tracking-widest text-green-700 uppercase mb-2">
                Passo {s.n}
              </div>
              <h3 className="text-xl font-bold text-ink-900 mb-2">{s.title}</h3>
              <p className="text-sm text-ink-500 max-w-xs mx-auto leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
