"use client";
import { useState } from "react";
import { MessageCircle, ArrowRight, Loader2, Check } from "lucide-react";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const WA_MSG = encodeURIComponent(
  process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ||
    "Olá! Quero testar o Fity AI por 7 dias grátis."
);
const WA_LINK = `https://wa.me/${WHATSAPP}?text=${WA_MSG}`;

// Validadores e máscaras (mesma logica do checkout)
const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const onlyDigits = (s: string) => s.replace(/\D/g, "");
const isValidPhone = (s: string) => {
  const d = onlyDigits(s);
  return d.length === 10 || d.length === 11;
};
const formatPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export default function LeadForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados controlados (pra mascara e validacao em tempo real)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Validacao em tempo real (trava o botao se invalido)
  const isNameValid = name.trim().length >= 3;
  const isEmailValid = isValidEmail(email);
  const isPhoneValid = isValidPhone(phone);
  const isFormValid = isNameValid && isEmailValid && isPhoneValid;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Pega o goal do select (unico nao-controlado)
    const goal = (e.currentTarget.elements.namedItem("goal") as HTMLSelectElement)?.value || "";

    const payload = {
      name,
      email,
      whatsapp: phone,
      goal,
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Tenta ler a mensagem específica do servidor
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Mostra a mensagem real do backend em vez de genérica
        setError(data.error || `Erro ${res.status}: ${res.statusText}`);
        return;
      }

      setDone(true);
      setName("");
      setEmail("");
      setPhone("");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      // Erro de rede (sem internet, servidor caiu, etc)
      console.error("Submit error:", err);
      setError("Não consegui conectar. Verifica tua internet e tenta de novo.");
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
          Bora começar?
          <br />
          Amanhã 7h teu briefing te espera no Zap.
        </h2>
        <p className="text-white/90 max-w-xl mx-auto mb-10">
          Coloca teu contato e a gente continua a conversa por lá.
          <br className="hidden sm:block" />
          Sem cartão, sem compromisso.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white text-ink-900 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto shadow-2xl"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="border border-ink-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
            <input
              name="email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu email"
              className="border border-ink-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
            <input
              name="whatsapp"
              required
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="Seu WhatsApp (com DDD)"
              maxLength={15}
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
            disabled={loading || !isFormValid}
            className="btn-primary w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
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
            🔒 Seus dados não vão para ninguém. Sem spam, sem grupo, sem promoção.
          </p>
        </form>

        <p className="mt-6 text-sm text-white/80">
          Ou fala comigo direto agora:{" "}
          <a
            href={WA_LINK}
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
