"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Shield,
  ArrowLeft,
  Sparkles,
  CreditCard,
  Zap,
  Lock,
  Receipt,
  User,
  ArrowRight,
  Mail,
  Phone,
  IdCard,
  Pencil,
} from "lucide-react";
import { PaymentForm } from "./components/PaymentForm";

// =================================================================
// FITY — Página de Checkout com Stepper (2 etapas)
// =================================================================
// Layout 2 colunas mantido em AMBAS as etapas:
//   ESQUERDA (lg:col-span-3) — form OU payment form
//   DIREITA  (lg:col-span-2) — resumo do pedido (sempre visivel)
//
// Step 1: Form com Nome / Email / Telefone / CPF
//         → clique em "Continuar" valida e avanca pro step 2
// Step 2: <PaymentForm> direto na pagina (sem modal, sem redirect)
//         → user escolhe cartao OU PIX
//         → cartao: tokeniza via MP SDK e cria payment
//         → PIX: cria payment e mostra QR code na mesma tela
//         → sucesso: redireciona pra /checkout/success
//
// O user NUNCA sai da pagina. O pagamento e processado em background
// via API do MP. Sem Brick, sem Checkout Pro, sem iframe.
// =================================================================

// Plano a ser vendido
const PLANS = {
  essencial: {
    id: "essencial",
    name: "Fity Essencial",
    description: "Briefing diário no Zap + plano personalizado",
    price: 29.0,
    features: [
      "Briefing diário no WhatsApp (7h)",
      "Plano alimentar personalizado",
      "Treino adaptado ao equipamento",
      "Lista de compras semanal",
    ],
  },
  pro: {
    id: "pro",
    name: "Fity Pro",
    description: "Briefing + adaptação semanal + comunidade",
    price: 49.0,
    features: [
      "Tudo do Essencial",
      "Adaptação semanal por IA",
      "Substituição infinita de alimentos",
      "Painel web com histórico",
      "Grupo de comunidade no Telegram",
    ],
    popular: true,
  },
  coach: {
    id: "coach",
    name: "Fity Coach",
    description: "Personal humano + IA",
    price: 79.0,
    features: [
      "Tudo do Pro",
      "Personal humano 1x/semana (20min)",
      "Ajuste de macros por objetivo",
      "Suporte prioridade",
    ],
  },
} as const;

type PlanId = keyof typeof PLANS;
type Step = "form" | "payment";

// Validadores e máscaras
const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const onlyDigits = (s: string) => s.replace(/\D/g, "");

// Telefone: 10 dígitos (fixo) ou 11 dígitos (celular com 9)
const isValidPhone = (s: string) => {
  const d = onlyDigits(s);
  return d.length === 10 || d.length === 11;
};

// CPF: 11 dígitos, rejeita todos dígitos iguais (000.000.000-00 etc)
const isValidCPF = (s: string) => {
  const d = onlyDigits(s);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  return true;
};

// Máscara de telefone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX, limitado a 11 números
const formatPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Máscara de CPF: XXX.XXX.XXX-XX, limitado a 11 números
const formatCPF = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// Planos validos (evita injection)
const VALID_PLANS: PlanId[] = ["essencial", "pro", "coach"];

function CheckoutContent() {
  // Le ?plan= da URL (vindo dos botoes de preco)
  // Ex: /checkout?plan=pro&price=49
  const searchParams = useSearchParams();
  const planFromUrl = searchParams.get("plan") as PlanId | null;

  // Plano (default = pro, mas se veio da URL usa esse)
  const initialPlan: PlanId =
    planFromUrl && VALID_PLANS.includes(planFromUrl) ? planFromUrl : "pro";
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  const plan = PLANS[planId];

  // Stepper: "form" → "payment"
  const [step, setStep] = useState<Step>("form");

  // URL params extras
  // paynow=1 (ja existente) = cobrar agora, sem trial
  // email=foo@bar.com = prefill do email (vem do link de renovacao do WhatsApp)
  // renewal=1 = indica que e uma renovacao (mostra banner diferente)
  const emailFromUrl = searchParams.get("email") || "";
  const isRenewal = searchParams.get("renewal") === "1" || emailFromUrl !== "";

  // Dados do formulario
  const [name, setName] = useState("");
  const [email, setEmail] = useState(emailFromUrl);
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");

  // Estados do pagamento
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Avanca pro step 2 (validacao feita no handleContinuar)
  function goToPayment() {
    setStep("payment");
  }

  // Valido/invalido em tempo real (pra travar o botao)
  const isNameValid = name.trim().length >= 3;
  const isEmailValid = isValidEmail(email);
  const isPhoneValid = isValidPhone(phone);
  const isCpfValid = isValidCPF(cpf);
  const isFormValid = isNameValid && isEmailValid && isPhoneValid && isCpfValid;

  // Handler do botao "Continuar"
  function handleContinuar(e: React.FormEvent) {
    e.preventDefault();

    // Validacao
    if (!isNameValid) {
      setError("Nome completo é obrigatório");
      return;
    }
    if (!isEmailValid) {
      setError("Email inválido");
      return;
    }
    if (!isPhoneValid) {
      setError("Telefone inválido (precisa ter DDD + número)");
      return;
    }
    if (!isCpfValid) {
      setError("CPF inválido (precisa ter 11 dígitos)");
      return;
    }

    setError(null);
    goToPayment();
  }

  // Volta pra edicao dos dados
  function voltarParaForm() {
    setStep("form");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/30">
      {/* HEADER */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm">
        <div className="container-wide py-4 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-green-700 transition"
          >
            <ArrowLeft size={16} /> Voltar para o site
          </a>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Lock size={14} /> Pagamento 100% seguro
          </div>
        </div>
      </header>

      <main className="container-wide py-8 lg:py-12">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-10 max-w-6xl mx-auto">
          {/* ========================================================== */}
          {/* COLUNA 1 (ESQUERDA) — FORM ou BRICK */}
          {/* ========================================================== */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
              {/* Stepper visual */}
              <div className="flex items-center gap-2 mb-6">
                <div
                  className={`flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase ${
                    step === "form" ? "text-green-700" : "text-slate-400"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      step === "form"
                        ? "bg-green-600 text-white"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {step === "form" ? "1" : <Check size={12} />}
                  </div>
                  Seus dados
                </div>
                <div className="flex-1 h-px bg-slate-200" />
                <div
                  className={`flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase ${
                    step === "payment" ? "text-green-700" : "text-slate-400"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      step === "payment"
                        ? "bg-green-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    2
                  </div>
                  Pagamento
                </div>
              </div>

              {/* ============= STEP 1: FORM ============= */}
              {step === "form" && (
                <form onSubmit={handleContinuar}>
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-green-700 uppercase mb-2">
                      <User size={14} /> Dados pessoais
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                      {isRenewal ? "Renovar assinatura" : "Quase lá"}
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                      {isRenewal
                        ? "Confirma rapidinho os dados pra reativar seu plano."
                        : "Preenche rapidinho pra gente liberar teu acesso."}
                    </p>
                    {isRenewal && emailFromUrl && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                        💡 Email pré-preenchido da sua assinatura. Confira se tá
                        certo antes de continuar.
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Nome */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Nome completo
                      </label>
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          required
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Maria Silva"
                          className="w-full border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email
                      </label>
                      <div className="relative">
                        <Mail
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Seu Melhor Email"
                          className="w-full border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
                        />
                      </div>
                    </div>

                    {/* Telefone */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Telefone (WhatsApp)
                      </label>
                      <div className="relative">
                        <Phone
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          required
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(formatPhone(e.target.value))}
                          placeholder="(11) 98888-7777"
                          maxLength={15}
                          className="w-full border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
                        />
                      </div>
                    </div>

                    {/* CPF */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        CPF
                      </label>
                      <div className="relative">
                        <IdCard
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          value={cpf}
                          onChange={(e) => setCpf(formatCPF(e.target.value))}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className="w-full border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !isFormValid}
                      className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        "Carregando..."
                      ) : (
                        <>
                          Continuar para pagamento
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>

                    <p className="text-xs text-slate-500 text-center pt-2">
                      Ao continuar, você concorda com nossos{" "}
                      <a href="#" className="underline">
                        Termos
                      </a>{" "}
                      e{" "}
                      <a href="#" className="underline">
                        Política de Privacidade
                      </a>
                      .
                    </p>
                  </div>
                </form>
              )}

              {/* ============= STEP 2: PAYMENT FORM (direto na pagina) ============= */}
              {step === "payment" && (
                <>
                  <div className="mb-5">
                    <button
                      onClick={voltarParaForm}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-3 transition"
                    >
                      <Pencil size={12} /> Editar dados
                    </button>
                    <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-green-700 uppercase mb-2">
                      <CreditCard size={14} /> Pagamento
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                      Como você quer pagar?
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                      Escolha entre cartão ou PIX. O pagamento é processado na
                      hora, sem sair dessa página.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-full px-3 py-1.5">
                      <User size={12} />
                      {name} · {email}
                    </div>
                  </div>

                  {/* PaymentForm custom (cartão + PIX direto, sem modal, sem redirect)
                      trialDays: por padrão é 7 (todos os planos incluem 7 dias grátis).
                      Pra "pular o trial e pagar agora" passa ?paynow=1 na URL. */}
                  <PaymentForm
                    amount={plan.price}
                    planName={plan.name}
                    customerName={name}
                    customerEmail={email}
                    customerPhone={phone}
                    customerCpf={cpf}
                    planId={plan.id}
                    trialDays={
                      searchParams.get("paynow") === "1" ? 0 : 7
                    }
                  />

                  <p className="text-[11px] text-slate-400 text-center mt-5">
                    Ao pagar, você concorda com nossos{" "}
                    <a href="#" className="underline hover:text-slate-600">
                      Termos
                    </a>{" "}
                    e{" "}
                    <a href="#" className="underline hover:text-slate-600">
                      Política de Privacidade
                    </a>
                    .
                  </p>
                </>
              )}

              {/* Badges de seguranca — sempre visivel */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Shield size={14} className="text-green-600" />
                  Dados criptografados
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock size={14} className="text-green-600" />
                  PCI-DSS compliant
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-green-600" />
                  Pagamento processado por Mercado Pago
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* COLUNA 2 (DIREITA) — RESUMO DO PEDIDO (sempre visivel) */}
          {/* ========================================================== */}
          <aside className="lg:col-span-2 order-1 lg:order-2">
            <div className="lg:sticky lg:top-6 space-y-4">
              {/* Seletor de plano */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
                <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-slate-500 uppercase mb-3">
                  <Receipt size={14} /> Resumo do pedido
                </div>

                <div className="space-y-2 mb-4">
                  {Object.values(PLANS).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlanId(p.id as PlanId)}
                      className={`w-full text-left rounded-2xl border p-3 transition-all ${
                        planId === p.id
                          ? "border-green-600 bg-green-50/50 ring-1 ring-green-200"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {planId === p.id && (
                            <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">
                                {p.name}
                              </span>
                              {"popular" in p && p.popular && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold tracking-wider uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                                  <Sparkles size={8} /> Popular
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-slate-900">
                            R$ {p.price.toFixed(0)}
                            <span className="text-xs text-slate-500 font-normal">
                              /mês
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card principal de resumo */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl">
                <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-green-400 uppercase mb-3">
                  <Zap size={14} /> Briefing diário personalizado
                </div>

                <h2 className="text-2xl font-extrabold mb-1">{plan.name}</h2>
                <p className="text-slate-300 text-sm mb-5">
                  {plan.description}
                </p>

                {/* Features */}
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} className="text-green-400" />
                      </div>
                      <span className="text-slate-100">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Divisor */}
                <div className="border-t border-slate-700 my-5" />

                {/* Totais */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Plano {plan.name}</span>
                    <span>R$ {plan.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Setup</span>
                    <span className="text-green-400">Grátis</span>
                  </div>
                  <div className="border-t border-slate-700 my-3" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-300 font-medium">
                      Total / mês
                    </span>
                    <span className="text-3xl font-extrabold text-white">
                      R$ {plan.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>

                {/* CTA de garantia */}
                <div className="mt-5 pt-5 border-t border-slate-700 flex items-center gap-3 text-xs text-slate-400">
                  <Shield size={20} className="text-green-400 shrink-0" />
                  <span>
                    7 dias grátis. Cancele quando quiser, sem multa, sem ligar
                    pra central.
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// Wrapper com Suspense (necessario pq useSearchParams precisa dele no App Router)
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500">Carregando checkout...</div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
