"use client";
import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Preciso baixar algum app?",
    a: "Não. Você fala comigo direto pelo WhatsApp. Briefing todo dia às 7h, lista de compras sábado, suporte 24/7. Só precisa de WhatsApp (que você já tem).",
  },
  {
    q: "Funciona se eu nunca treinei?",
    a: "Sim. O Fity adapta o treino ao seu equipamento e nível. Se você nunca treinou, começo com séries leves de 30min. Se já é avançado, vai pra hipertrofia pesada.",
  },
  {
    q: "Tem pra dieta específica (vegano, sem glúten, low carb)?",
    a: "Sim. No onboarding você marca suas restrições e a IA adapta todas as receitas. Substitui automaticamente qualquer item que você não pode comer.",
  },
  {
    q: "Posso cancelar a qualquer hora?",
    a: "Sim, sem multa, sem ligação, sem letra miúda. Clica num botão no painel e pronto. Seu briefing continua até o fim do ciclo pago.",
  },
  {
    q: "Como funciona o teste grátis?",
    a: "Você clica em \"Testar 7 dias grátis\", fala comigo no WhatsApp, eu faço seu briefing personalizado por 7 dias. Se gostar, assina por R$29/mês. Sem cartão pra testar.",
  },
  {
    q: "Por que tão barato?",
    a: "Porque é IA, não humano. Um personal + nutricionista cobra R$500+/mês e você ainda tem que pensar no que fazer. O Fity decide por você, todo dia, por R$29.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="section-pad bg-bg-soft">
      <div className="container-narrow">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="eyebrow">FAQ</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">
            Perguntas que todo mundo faz
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div
              key={i}
              className="bg-white border border-ink-300/50 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left"
              >
                <span className="font-semibold text-ink-900">{f.q}</span>
                {open === i ? (
                  <Minus size={20} className="text-green-600 shrink-0" />
                ) : (
                  <Plus size={20} className="text-green-600 shrink-0" />
                )}
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-ink-500 leading-relaxed">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
