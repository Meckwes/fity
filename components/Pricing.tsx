"use client";
import { Check, MessageCircle } from "lucide-react";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const MSG = encodeURIComponent(
  process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ||
    "Oi! Quero testar o Fity por 7 dias gratis."
);
const WA_LINK = `https://wa.me/${WHATSAPP}?text=${MSG}`;

const tiers = [
  {
    name: "Essencial",
    price: 29,
    badge: null,
    highlight: false,
    desc: "Pra quem tá começando agora",
    features: [
      "Briefing diário no Zap (7h)",
      "Plano alimentar personalizado",
      "Treino adaptado ao seu equipamento",
      "Lista de compras semanal (sábado)",
      "Comunidade no Telegram",
    ],
    cta: "Começar com Essencial",
  },
  {
    name: "Pro",
    price: 49,
    badge: "Mais popular",
    highlight: true,
    desc: "Pra quem quer resultado sério",
    features: [
      "Tudo do Essencial",
      "Adaptação semanal de IA avançada",
      "Substituição infinita de alimentos",
      "Painel web com histórico de peso",
      "Acesso ao grupo de coaching",
      "Suporte prioritário",
    ],
    cta: "Quero o Pro",
  },
  {
    name: "Coach",
    price: 79,
    badge: null,
    highlight: false,
    desc: "Pra hipertrofia, atletas, performance",
    features: [
      "Tudo do Pro",
      "Personal humano 1×/semana (15min)",
      "Ajuste de macros por objetivo",
      "Suporte 24h",
      "Convite para grupo VIP",
    ],
    cta: "Falar com o time",
  },
];

export default function Pricing() {
  return (
    <section id="precos" className="section-pad">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="eyebrow">Preços</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">
            Menos que uma <span className="text-green-600">refeição fora</span>.
            <br />
            Mais consistente que um app.
          </h2>
          <p className="mt-4 text-ink-500">
            Todos os planos incluem 7 dias grátis. Sem cartão pra testar.
            Cancela quando quiser, sem letra miúda.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((t, i) => (
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
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  t.highlight
                    ? "btn-primary w-full"
                    : "btn-secondary w-full"
                }
              >
                <MessageCircle size={18} /> {t.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-ink-500 mt-8">
          💳 PIX · Cartão · Boleto · Cancela em 1 clique
        </p>
      </div>
    </section>
  );
}
