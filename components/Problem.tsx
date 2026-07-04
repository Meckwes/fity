"use client";
import { Brain, Clock, DollarSign } from "lucide-react";

const pains = [
  {
    icon: Brain,
    title: "Sobrecarga",
    body: "Milhares de receitas, dezenas de tipos de treino, opinião de 50 influenciadores. Paralisia por análise. Você não começa porque não sabe por onde.",
  },
  {
    icon: Clock,
    title: "Sem tempo de pensar",
    body: "Toda manhã você precisa decidir o que comer, quanto, e o que treinar. Quem trabalha 8h+ e tem família não tem banda cognitiva pra decidir mais isso.",
  },
  {
    icon: DollarSign,
    title: "Fit é caro e difícil",
    body: "Plano de personal trainer + nutricionista = R$ 500+/mês. Apps de hoje dão biblioteca genérica que você não usa. Você acaba desistindo no dia 10.",
  },
];

export default function Problem() {
  return (
    <section className="section-pad bg-bg-soft">
      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="eyebrow">O Problema</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">
            Você não precisa de mais conteúdo.
            <br />
            <span className="text-green-600">Precisa de decisão.</span>
          </h2>
          <p className="mt-4 text-ink-500">
            95% das receitas salvas no seu celular nunca são preparadas.
            Você baixa 3 apps de fitness por ano e usa nenhum por mais de 30 dias.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {pains.map((p, i) => (
            <div key={i} className="card text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 mx-auto flex items-center justify-center mb-4">
                <p.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-ink-900 mb-2">{p.title}</h3>
              <p className="text-sm text-ink-500 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
