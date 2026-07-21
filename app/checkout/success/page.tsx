"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  MessageCircle,
  Sparkles,
  Zap,
  Calendar,
} from "lucide-react";

// =================================================================
// FITY — Página de Sucesso após pagamento
// =================================================================
// Recebe parametros do Mercado Pago via URL (payment_id, status, etc)
// Mostra confirmacao + CTA pro WhatsApp + instrucoes do proximo passo
// =================================================================

function SuccessContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id");
  const status = searchParams.get("status");
  const externalRef = searchParams.get("external_reference");
  const isTrial = searchParams.get("trial") === "1";

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Da um tempo pro webhook processar (supabase + whatsapp welcome)
    const timer = setTimeout(() => setChecking(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (checking) {
    return (
      <div className="text-center py-20">
        <Loader2 size={48} className="animate-spin mx-auto text-green-600 mb-4" />
        <p className="text-slate-600">Confirmando teu pagamento...</p>
      </div>
    );
  }

  // CTA do WhatsApp (numero do .env ou fallback generico)
  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
  const whatsappMsg =
    encodeURIComponent(
      "Oi! Acabei de assinar o Fity AI e quero começar o onboarding."
    );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;

  return (
    <div className="text-center">
      {/* Icone de sucesso animado */}
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-20" />
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={56} className="text-green-600" strokeWidth={2.5} />
        </div>
      </div>

      {isTrial ? (
        <>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
            Trial de 7 dias iniciado! 🎉
          </h1>

          <p className="text-lg text-slate-600 mb-6 max-w-md mx-auto">
            Bem-vindo(a) ao <strong className="text-slate-900">Fity AI</strong>.
            Seu cartão <strong>não foi cobrado agora</strong>. Você tem 7 dias
            grátis pra experimentar tudo.
          </p>

          {/* Box destaque do trial */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-5 max-w-md mx-auto mb-8 text-left">
            <h2 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <Sparkles size={18} /> Como funciona o trial
            </h2>
            <ol className="text-sm text-green-800 space-y-2.5">
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span>
                  <strong>Agora</strong> — Te chamamos no WhatsApp pra começar
                  (uns 2 min de setup)
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span>
                  <strong>Dia 6</strong> — Te avisamos no Zap que amanhã será
                  a primeira cobrança
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <span>
                  <strong>Dia 7</strong> — Cobramos R${" "}
                  {externalRef ? "49" : "49"},00 (ou{" "}
                  <a
                    href="/"
                    className="underline font-semibold"
                  >
                    cancela antes
                  </a>{" "}
                  e nada é cobrado)
                </span>
              </li>
            </ol>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
            Pagamento aprovado! 🎉
          </h1>

          <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
            Bem-vindo(a) ao <strong className="text-slate-900">Fity AI</strong>.
            Em instantes, nosso bot te chama no WhatsApp pra começar o
            onboarding.
          </p>
        </>
      )}

      {/* CTA principal: falar com o bot AGORA */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2.5 bg-gradient-to-br from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold py-4 px-7 rounded-2xl shadow-lg shadow-green-600/25 transition mb-8"
      >
        <MessageCircle size={20} strokeWidth={2.4} />
        Falar com o Fity AI agora
        <ArrowRight size={18} strokeWidth={2.4} />
      </a>

      {/* Detalhes do pagamento */}
      {paymentId && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 max-w-sm mx-auto mb-6 text-left">
          <div className="flex justify-between text-sm py-1">
            <span className="text-slate-500">ID do pagamento</span>
            <span className="font-mono text-slate-900 text-xs">
              {paymentId.slice(0, 16)}...
            </span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-slate-500">Status</span>
            <span className="font-semibold text-green-600 uppercase flex items-center gap-1">
              <CheckCircle2 size={12} />
              {status || "approved"}
            </span>
          </div>
          {externalRef && (
            <div className="flex justify-between text-sm py-1">
              <span className="text-slate-500">Plano</span>
              <span className="font-semibold text-slate-900 uppercase text-xs">
                {externalRef}
              </span>
            </div>
          )}
        </div>
      )}

      {/* O que vem por ai */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 max-w-md mx-auto mb-8 text-left">
        <h2 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
          <Sparkles size={18} /> O que vem por aí
        </h2>
        <ol className="text-sm text-green-800 space-y-3">
          <li className="flex items-start gap-2.5">
            <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <span>
              <strong>Agora</strong> — Bot te chama no Zap com as primeiras
              perguntas (uns 2 min)
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <span>
              <strong>Hoje</strong> — Briefing personalizado montado com base
              nas suas respostas
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
              3
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={12} className="inline" />
              <span>
                <strong>Amanhã 7h</strong> — Primeiro briefing diário no Zap ☀️
              </span>
            </span>
          </li>
        </ol>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-green-700 transition text-sm"
      >
        Voltar pra página inicial <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/30 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <Suspense
          fallback={
            <div className="text-center">
              <Loader2 size={32} className="animate-spin mx-auto" />
            </div>
          }
        >
          <SuccessContent />
        </Suspense>
      </div>
    </div>
  );
}