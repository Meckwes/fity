"use client";
import { CalendarDays } from "lucide-react";

const days = [
  {
    day: "Sábado",
    tag: "Lista de compras",
    color: "bg-orange-100 text-orange-600 border-orange-200",
    items: [
      "🥩 Frango (800g) · Carne moída (500g)",
      "🥚 Ovos (12un) · Queijo branco (300g)",
      "🍚 Arroz · Feijão · Aveia · Granola",
      "🥬 Brócolis · Abobrinha · Alface · Tomate",
      "🍌 Banana · Maçã · Limão",
    ],
  },
];

const briefing = [
  {
    time: "07:02",
    text: "Bom dia, Jéssica! ☀️ Terça, dia 23",
    type: "in",
  },
  {
    time: "07:02",
    text: "🏋️ Treino hoje: Inferior · 35min\n- Agachamento 4×10\n- Stiff 4×10\n- Cadeira abdutora 3×12\n- Panturrilha 4×15",
    type: "in",
  },
  {
    time: "07:02",
    text: "🍽️ Almoço: marmita de frango (150g) + arroz (4 col.) + feijão + salada. Levou? 😄",
    type: "in",
  },
  {
    time: "07:02",
    text: "🍽️ Jantar: omelete de 3 ovos + salada + 1 col. azeite",
    type: "in",
  },
  {
    time: "07:02",
    text: "💧 Meta água: 2,5L até 19h",
    type: "in",
  },
  {
    time: "07:08",
    text: "✅ Tudo certo, bora!",
    type: "out",
  },
  {
    time: "07:08",
    text: "👊 Ótimo! Bora com tudo. Bebe água antes de sair 💧",
    type: "in",
  },
];

export default function SampleBriefing() {
  return (
    <section className="section-pad bg-bg-soft">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="eyebrow">Um dia com o Fity</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">
            Esse é o briefing que <span className="text-green-600">chega no seu Zap</span> às 7h.
          </h2>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 items-stretch">
          {/* Saturday shopping list card */}
          <div className="lg:col-span-2">
            <div className="card-green h-full">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays size={20} className="text-orange-600" />
                <span className="text-xs font-bold tracking-widest text-orange-600 uppercase">
                  Sábado · 07:00
                </span>
              </div>
              <h3 className="text-xl font-bold text-ink-900 mb-4">
                Sua lista de compras da semana:
              </h3>
              <ul className="space-y-2.5">
                {days[0].items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-ink-700"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 accent-green-600"
                      readOnly
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-orange-200">
                <p className="text-xs text-ink-500">
                  💡 Tá sem bateria mental para montar? Clica para enviar para{" "}
                  <strong className="text-orange-600">iFood Compras</strong> ou{" "}
                  <strong className="text-orange-600">Zé Delivery</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Chat mockup */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl border border-ink-300/50 shadow-xl overflow-hidden h-full flex flex-col">
              <div className="bg-green-700 text-white px-5 py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-yellow-400 flex items-center justify-center font-bold">
                  F
                </div>
                <div>
                  <div className="font-semibold">Fity</div>
                  <div className="text-xs opacity-80">online · te enviou uma mensagem</div>
                </div>
              </div>
              <div className="bg-[#efeae2] px-4 py-5 space-y-2 flex-1">
                {briefing.map((msg, i) => (
                  <div
                    key={i}
                    className={`chat-bubble ${
                      msg.type === "in" ? "in" : "out"
                    } px-3 py-2.5 text-sm whitespace-pre-wrap leading-relaxed`}
                  >
                    {msg.text}
                    <div className="chat-time">
                      {msg.time} {msg.type === "out" && "✓✓"}
                    </div>
                  </div>
                ))}
                <div className="text-center text-xs text-ink-500 pt-3 italic">
                  — fim do briefing. Agora é só executar. —
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
