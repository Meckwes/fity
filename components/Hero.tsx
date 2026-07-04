"use client";
import { ArrowRight, MessageCircle, Star } from "lucide-react";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const MSG = encodeURIComponent(
  process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ||
    "Oi! Quero testar o Fity por 7 dias gratis."
);
const WA_LINK = `https://wa.me/${WHATSAPP}?text=${MSG}`;

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-green-50 to-white -z-10" />
      <div className="absolute inset-0 bg-dots -z-10 opacity-50" />

      <div className="container-wide">
        {/* Top badge */}
        <div className="flex justify-center mb-6 animate-fade-in">
          <span className="inline-flex items-center gap-2 bg-white border border-green-200 rounded-full px-4 py-1.5 text-sm shadow-sm">
            <span className="flex items-center gap-0.5 text-orange-500">
              <Star size={14} fill="currentColor" />
              <Star size={14} fill="currentColor" />
              <Star size={14} fill="currentColor" />
              <Star size={14} fill="currentColor" />
              <Star size={14} fill="currentColor" />
            </span>
            <span className="text-ink-700">+200 pessoas já estão testando</span>
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left — copy */}
          <div className="text-center lg:text-left animate-slide-up">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight text-ink-900">
              Acabou a indecisão.
              <br />
              <span className="text-green-600">Todo dia 7h</span> no seu Zap:
              <br />
              <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                o que comer e treinar.
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-ink-500 max-w-xl mx-auto lg:mx-0">
              Você recebe no WhatsApp o plano alimentar do dia, o treino de 35min,
              e a lista de compras da semana. Personalizado pra você, em português.
              Por <strong className="text-ink-900">R$ 29/mês</strong>.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-base"
              >
                <MessageCircle size={20} /> Testar 7 dias grátis
              </a>
              <a href="#como-funciona" className="btn-secondary text-base">
                Como funciona <ArrowRight size={18} />
              </a>
            </div>

            <p className="mt-4 text-sm text-ink-500">
              ✓ Sem cartão · ✓ Cancela quando quiser · ✓ Setup em 5 minutos
            </p>
          </div>

          {/* Right — phone mockup */}
          <div className="relative animate-fade-in">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="mx-auto w-[280px] sm:w-[320px] lg:w-[360px]">
      {/* Phone frame */}
      <div className="relative bg-ink-900 rounded-[42px] p-2.5 shadow-2xl">
        <div className="bg-white rounded-[34px] overflow-hidden relative">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-ink-900 rounded-b-2xl z-10" />

          {/* Status bar */}
          <div className="bg-green-700 text-white text-xs px-6 pt-8 pb-3 flex justify-between items-center">
            <span className="font-semibold">7:02</span>
            <span className="text-[10px]">Fity • online</span>
            <span>🔋 86%</span>
          </div>

          {/* Header */}
          <div className="bg-green-700 text-white px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center font-bold text-sm">
              F
            </div>
            <div>
              <div className="font-semibold text-sm">Fity</div>
              <div className="text-[10px] opacity-80">online</div>
            </div>
          </div>

          {/* Chat */}
          <div className="bg-[#efeae2] px-3 py-4 space-y-2 min-h-[420px]">
            <div className="chat-bubble in px-3 py-2">
              <div className="text-xs">
                <strong className="text-green-700">Bom dia, Jéssica! ☀️</strong>
                <br />
                <strong>Terça, dia 23</strong>
              </div>
              <div className="text-xs mt-2 space-y-1">
                <div>🏋️ <strong>Treino hoje:</strong> Inferior (glúteo + posterior) · 35min</div>
                <div className="pl-3 text-ink-500">
                  Agachamento 4×10 · Stiff 4×10 · Cadeira abdutora 3×12
                </div>
                <div className="mt-2">🍽️ <strong>Almoço (trabalho):</strong></div>
                <div className="pl-3 text-ink-500">
                  Marmita de frango (150g) + arroz + feijão + salada
                </div>
                <div className="mt-2">🍽️ <strong>Jantar:</strong></div>
                <div className="pl-3 text-ink-500">
                  Omelete de 3 ovos + salada + 1 col. azeite
                </div>
                <div className="mt-2">💧 <strong>Meta água:</strong> 2,5L até 19h</div>
              </div>
              <div className="chat-time">07:02 ✓✓</div>
            </div>

            <div className="chat-bubble out px-3 py-2">
              <div className="text-xs">✅ Tudo certo, bora!</div>
              <div className="chat-time text-right">07:08 ✓✓</div>
            </div>

            <div className="chat-bubble in px-3 py-2">
              <div className="text-xs">
                👊 Ótimo! Bora com tudo. Bebe água antes de sair de casa 💧
              </div>
              <div className="chat-time">07:08 ✓✓</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
