"use client";
import { useState } from "react";
import { MessageCircle, ArrowRight, Loader2, Check } from "lucide-react";

export default function LeadForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      whatsapp: fd.get("whatsapp"),
      goal: fd.get("goal"),
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      setDone(true);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError("Algo deu errado. Tenta de novo ou fala comigo no Zap.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <section className="section-pad bg-green-50">
        <div className="container-narrow text-center">
          <div className="w-16 h-16 rounded-full bg-green-600 mx-auto flex items-center justify-center mb-6">
            <Check size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-ink-900 mb-3">
            Pronto! 🎉
          </h2>
          <p className="text-ink-700">
            Te mandei uma mensagem no Zap. Confere lá e vem falar comigo.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="comecar" className="section-pad bg-gradient-to-br from-green-600 to-emerald-700 text-white">
      <div className="container-narrow text-center">
        <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-white/20 text-white mb-4">
          Comece agora
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight">
          Toma a decisão hoje.
          <br />
          Amanhã 7h seu briefing já tá no Zap.
        </h2>
        <p className="text-white/90 max-w-xl mx-auto mb-10">
          Deixa teu contato que eu te mando o link do WhatsApp pra começar.
          <br className="hidden sm:block" />
          7 dias grátis, sem cartão, sem letra miúda.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white text-ink-900 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto shadow-2xl"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              name="name"
              required
              placeholder="Seu nome"
              className="border border-ink-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
            <input
              name="email"
              required
              type="email"
              placeholder="Seu email"
              className="border border-ink-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
            <input
              name="whatsapp"
              required
              placeholder="Seu WhatsApp (com DDD)"
              className="border border-ink-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 sm:col-span-2"
            />
            <select
              name="goal"
              className="border border-ink-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 sm:col-span-2 bg-white"
              defaultValue=""
            >
              <option value="" disabled>
                Qual seu objetivo principal?
              </option>
              <option value="Emagrecer">Emagrecer</option>
              <option value="Ganhar massa muscular">Ganhar massa muscular</option>
              <option value="Saúde e qualidade de vida">Saúde e qualidade de vida</option>
              <option value="Performance atlética">Performance atlética</option>
              <option value="Recomeçar do zero">Recomeçar do zero</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-6"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Enviando...
              </>
            ) : (
              <>
                Quero testar 7 dias grátis <ArrowRight size={18} />
              </>
            )}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
          <p className="text-xs text-ink-500 mt-4">
            🔒 Seus dados não vão pra ninguém. Sem spam, sem grupo, sem promoção.
          </p>
        </form>

        <p className="mt-6 text-sm text-white/80">
          Ou fala comigo direto agora:{" "}
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:no-underline font-semibold"
          >
            <MessageCircle size={14} className="inline mr-1" />
            Abrir WhatsApp
          </a>
        </p>
      </div>
    </section>
  );
}
