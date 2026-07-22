"use client";
import { Check, ArrowRight } from "lucide-react";

// WhatsApp do time (variavel) — usado pelo CTA "Falar com o time"
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const COACH_MSG = encodeURIComponent(
  "Olá! Tenho interesse no plano Fity Coach (R$ 79/mês) e queria conversar com o time antes de fechar."
);
const COACH_WA_LINK = `https://wa.me/${WHATSAPP}?text=${COACH_MSG}`;

// Planos - cada um aponta direto pro checkout com plano + preço,
// EXCETO o Coach, que leva pro WhatsApp do time (é um plano high-ticket
// com personal humano — a pessoa quer conversar antes de pagar)
const tiers = [
  {
    id: "essencial",
    name: "Essencial",
    price: 29,
    badge: null,
    highlight: false,
    desc: "Pra quem tá começando agora",
    features: [
      "Briefing diário no WhatsApp (7h)",
      "Monte seu plano alimentar personalizado",
      "Treino no seu ritmo",
      "Lista de compras semanal (sábado)",
      "Comunidade no Telegram",
    ],
    cta: "Começar com Essencial",
    href: "/checkout?plan=essencial&price=29",
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    badge: "Mais popular",
    highlight: true,
    desc: "Pra quem quer resultado sério",
    features: [
      "Plano Essencial",
      "Adaptação semanal de IA avançada",
      "Substituição infinita de alimentos",
      "Relatório semanal de evolução",
      "Receitas detalhadas sob demanda",
      "Suporte prioritário",
    ],
    cta: "Quero o Pro",
    href: "/checkout?plan=pro&price=49",
  },
  {
    id: "coach",
    name: "Coach",
    price: 79,
    badge: null,
    highlight: false,
    desc: "Pra hipertrofia, atletas, performance",
    features: [
      "Plano Pro",
      "Personal/nutrição humano por 20min 1×/semana",
      "Ajuste de macros por objetivo",
      "Suporte 24h",
      "Comunidade VIP no Telegram",
    ],
    cta: "Falar com o time",
    href: COACH_WA_LINK,
  },
];

export default function Pricing() {
  return (
    <section id="precos" className="section-pad">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="eyebrow">Preços</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">
            Não é mais um app.
            <br />
            É seu personal no <span className="text-green-600">Zap</span>, todo dia às 7h.
          </h2>
          <p className="mt-4 text-ink-500">
            Todos os planos incluem 7 dias grátis. Cancela em 1 clique, sem multa.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((t, i) => {
            return (
              <div
                key={i}
                className={`relative rounded-3xl p-7 transition-all ${
                  t.highlight
                    ? "bg-gradient-to-b from-green-50 to-white border-2 border-green-500 shadow-xl shadow-green-500/10 scale-[1.03]"
                    : "bg-white border border-ink-300/50 hover:border-green-300"
                }`}
              >
                {t.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full">
                    {t.badge}
                  </div>
                )}
                <div className="text-xs font-bold tracking-widest text-ink-500 uppercase mb-2">
                  {t.name}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-ink-900">
                    R$ {t.price}
                  </span>
                  <span className="text-ink-500">/mês</span>
                </div>
                <p className="text-sm text-ink-500 mb-6">{t.desc}</p>
                <ul className="space-y-3 mb-7 min-h-[180px]">
                  {t.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <Check
                        size={18}
                        className={`shrink-0 mt-0.5 ${
                          t.highlight ? "text-green-600" : "text-green-500"
                        }`}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={t.href}
                  target={t.href.startsWith("http") ? "_blank" : undefined}
                  rel={t.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className={
                    t.highlight
                      ? "btn-primary w-full"
                      : "btn-secondary w-full"
                  }
                >
                  {t.cta} <ArrowRight size={18} />
                </a>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-ink-500 mt-8">
          💳 PIX · Cartão · Boleto · Cancela em 1 clique
        </p>

        {/* Link secundario pro trial gratis — pra quem ainda quer testar antes */}
        <div className="text-center mt-6">
          <p className="text-sm text-ink-500">
            Ainda não tem certeza?{" "}
            <a
              href="#comecar"
              className="text-green-700 font-semibold underline underline-offset-4 hover:text-green-800"
            >
              Testar grátis por 7 dias antes de decidir →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
