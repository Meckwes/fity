"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Smartphone,
  Lock,
  Shield,
  Check,
  ChevronDown,
  Zap,
  Copy,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";

// =================================================================
// FITY — PaymentForm (custom, sem Brick, sem redirect, sem modal)
// =================================================================
// Implementacao DIRETA: o form vive dentro da pagina de checkout.
// O user nunca sai do Fity. O pagamento e processado via API do MP.
//
// Suporta:
//  - CARTAO: tokeniza via API do MP (client-side, PCI-compliant)
//    e envia o token pro backend que cria a payment.
//  - PIX: backend cria a payment e retorna o QR code. Mostra na tela
//    e fica polling o status ate aprovar.
//
// TOKENIZACAO DO CARTAO:
// A SDK @mercadopago/sdk-react expoe createCardToken, mas e pra
// "secure fields" (componentes UI). Pra tokenizar dados brutos do
// form custom, chamamos direto a API:
//   POST https://api.mercadopago.com/v1/card_tokens?public_key=...
// Isso mantem o cartao 100% fora do nosso servidor (PCI compliant).
//
// PARA TESTAR EM SANDBOX:
//  1. Vai em https://www.mercadopago.com.br/developers/panel/test-accounts
//  2. Cria um test user buyer (se ja nao tem) e copia o email dele
//  3. Coloca no .env.local: MP_DEV_PAYER_EMAIL=test_user_xxxx@testuser.com
//  4. Em producao isso NAO e necessario (usa o email do cliente)
// =================================================================

// Chama a API do MP pra tokenizar o cartao (client-side, seguro)
async function tokenizeCard(params: {
  cardNumber: string;
  securityCode: string;
  expirationMonth: string;
  expirationYear: string;
  cardholderName: string;
  identificationType: string;
  identificationNumber: string;
}): Promise<string> {
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("NEXT_PUBLIC_MP_PUBLIC_KEY nao configurado");
  }

  const res = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_number: params.cardNumber,
        security_code: params.securityCode,
        expiration_month: parseInt(params.expirationMonth, 10),
        expiration_year: parseInt(params.expirationYear.length === 2 ? `20${params.expirationYear}` : params.expirationYear, 10),
        cardholder: {
          name: params.cardholderName,
          identification: {
            type: params.identificationType,
            number: params.identificationNumber,
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.message ||
        errData?.error?.message ||
        "Falha ao tokenizar cartao. Verifica os dados."
    );
  }

  const data = await res.json();
  if (!data.id) {
    throw new Error("Resposta do MP sem token");
  }
  return data.id;
}

type PaymentFormProps = {
  amount: number;
  planName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  planId: string;
  // Trial: se > 0, cobra so depois de N dias (capture: false no MP).
  // PIX nao suporta trial (pagamento instantaneo) - escondemos essa opcao.
  trialDays?: number;
};

type PaymentResult = {
  status: "approved" | "pending" | "rejected" | "in_process";
  status_detail?: string;
  paymentId?: string;
};

type PixData = {
  paymentId: string;
  qrCodeBase64: string;
  qrCodeText: string;
};

export function PaymentForm({
  amount,
  planName,
  customerName,
  customerEmail,
  customerPhone,
  customerCpf,
  planId,
  trialDays = 0,
}: PaymentFormProps) {
  const [method, setMethod] = useState<"card" | "pix">("card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============ CARD STATE ============
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState(customerName);
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [installments, setInstallments] = useState(1);

  // ============ PIX STATE ============
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixPolling, setPixPolling] = useState(false);
  const [pixCountdown, setPixCountdown] = useState(0);
  const [copied, setCopied] = useState(false);

  // ============ RESULT STATE ============
  const [result, setResult] = useState<PaymentResult | null>(null);

  // Countdown pra re-checar PIX
  useEffect(() => {
    if (!pixData || result?.status === "approved") return;
    setPixCountdown(0);
  }, [pixData?.paymentId, result?.status]);

  // ============ Formatadores ============
  const formatCardNumber = (v: string) =>
    v
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, "$1 ")
      .trim();

  const detectBrand = (num: string): string => {
    const n = num.replace(/\D/g, "");
    if (n.length === 0) return "unknown";
    // IMPORTANTE: checar bandeiras especificas ANTES das genericas
    // (Elo e Hipercard compartilham prefixos com Visa e Discover)
    // Elo: prefixos BR (4011, 4312, 4389, 5041, 6277, 6362, 6363, 6504-6509, 6516, 6550)
    if (
      /^(4011|4312|4389|5041|6277|6362|6363|6504|6505|6506|6507|6508|6509|6516|6550)/.test(
        n
      )
    )
      return "elo";
    // Hipercard: 6062
    if (/^6062/.test(n)) return "hipercard";
    // Visa: comeca com 4 (mas NAO eh Elo/Hipercard)
    if (/^4/.test(n)) return "visa";
    // Mastercard: 51-55 (legacy) ou 22-27 (new 2-series 2221-2720)
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "master";
    // Amex: 34 ou 37
    if (/^3[47]/.test(n)) return "amex";
    // Diners
    if (/^3(0[0-5]|[68])/.test(n)) return "diners";
    // Discover
    if (/^(6011|65|64[4-9]|622)/.test(n)) return "discover";
    return "unknown";
  };

  // Info visual das bandeiras (cor oficial + logo SVG)
  // Se `logo` existir, renderiza o SVG no lugar do badge textual
  const BRAND_INFO: Record<
    string,
    {
      name: string;
      key: string;
      bg: string;
      text: string;
      logo?: React.ReactNode;
    }
  > = {
    visa: {
      name: "Visa",
      key: "visa",
      bg: "",
      text: "",
      // Logo Visa: texto branco italico bold em fundo azul marinho
      logo: (
        <svg viewBox="0 0 50 16" className="w-14 h-5" aria-label="Visa">
          <rect width="50" height="16" rx="2" fill="#1A1F71" />
          <text
            x="25"
            y="12"
            textAnchor="middle"
            fill="white"
            fontFamily="Arial Black, Helvetica, sans-serif"
            fontSize="10"
            fontWeight="900"
            fontStyle="italic"
            letterSpacing="0.5"
          >
            VISA
          </text>
        </svg>
      ),
    },
    master: {
      name: "Mastercard",
      key: "master",
      bg: "",
      text: "",
      // Logo oficial Mastercard: dois circulos entrelacados
      // Vermelho #EB001B + Laranja #F79E1B, sobreposicao #FF5F00
      logo: (
        <svg viewBox="0 0 40 25" className="w-14 h-9" aria-label="Mastercard">
          <circle cx="15" cy="12.5" r="10" fill="#EB001B" />
          <circle cx="25" cy="12.5" r="10" fill="#F79E1B" />
          <path
            d="M 20 4.5 a 8 8 0 0 1 0 16 a 8 8 0 0 1 0 -16"
            fill="#FF5F00"
          />
        </svg>
      ),
    },
    amex: {
      name: "American Express",
      key: "amex",
      bg: "",
      text: "",
      // Logo Amex: caixa azul com "AMEX" bold (padrao igual as outras bandeiras)
      logo: (
        <svg viewBox="0 0 50 16" className="w-14 h-5" aria-label="American Express">
          <rect width="50" height="16" rx="2" fill="#2E77BC" />
          <text
            x="25"
            y="12"
            textAnchor="middle"
            fill="white"
            fontFamily="Arial Black, Helvetica, sans-serif"
            fontSize="9.5"
            fontWeight="900"
            letterSpacing="1"
          >
            AMEX
          </text>
        </svg>
      ),
    },
    elo: {
      name: "Elo",
      key: "elo",
      bg: "",
      text: "",
      // Logo Elo: texto "elo" italico bold em fundo preto
      logo: (
        <svg viewBox="0 0 50 16" className="w-14 h-5" aria-label="Elo">
          <rect width="50" height="16" rx="2" fill="#000" />
          <text
            x="25"
            y="13"
            textAnchor="middle"
            fill="white"
            fontFamily="Arial Black, Helvetica, sans-serif"
            fontSize="13"
            fontWeight="900"
            fontStyle="italic"
            letterSpacing="0.5"
          >
            elo
          </text>
        </svg>
      ),
    },
    hipercard: {
      name: "Hipercard",
      key: "hipercard",
      bg: "",
      text: "",
      // Logo Hipercard: texto branco bold em fundo vermelho escuro
      logo: (
        <svg viewBox="0 0 50 16" className="w-14 h-5" aria-label="Hipercard">
          <rect width="50" height="16" rx="2" fill="#8B0000" />
          <text
            x="25"
            y="11.5"
            textAnchor="middle"
            fill="white"
            fontFamily="Arial Black, Helvetica, sans-serif"
            fontSize="7"
            fontWeight="900"
            letterSpacing="0.3"
          >
            HIPERCARD
          </text>
        </svg>
      ),
    },
    diners: {
      name: "Diners Club",
      key: "diners",
      bg: "",
      text: "",
      // Logo Diners: texto branco bold em fundo azul
      logo: (
        <svg viewBox="0 0 50 16" className="w-14 h-5" aria-label="Diners Club">
          <rect width="50" height="16" rx="2" fill="#0079BE" />
          <text
            x="25"
            y="11.5"
            textAnchor="middle"
            fill="white"
            fontFamily="Arial Black, Helvetica, sans-serif"
            fontSize="7"
            fontWeight="900"
            letterSpacing="0.4"
          >
            DINERS
          </text>
        </svg>
      ),
    },
    discover: {
      name: "Discover",
      key: "discover",
      bg: "",
      text: "",
      // Logo Discover: texto branco bold em fundo laranja
      logo: (
        <svg viewBox="0 0 50 16" className="w-14 h-5" aria-label="Discover">
          <rect width="50" height="16" rx="2" fill="#FF6000" />
          <text
            x="25"
            y="11.5"
            textAnchor="middle"
            fill="white"
            fontFamily="Arial Black, Helvetica, sans-serif"
            fontSize="6.5"
            fontWeight="900"
            letterSpacing="0.4"
          >
            DISCOVER
          </text>
        </svg>
      ),
    },
    unknown: { name: "", key: "unknown", bg: "", text: "" },
  };

  const currentBrand =
    BRAND_INFO[detectBrand(cardNumber)] || BRAND_INFO.unknown;

  // ============ SUBMIT CARD ============
  async function handleCardSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Validacoes basicas
      const cleanNumber = cardNumber.replace(/\D/g, "");
      if (cleanNumber.length < 13) throw new Error("Numero de cartao invalido");
      if (!expiryMonth || !expiryYear) throw new Error("Validade invalida");
      if (securityCode.length < 3) throw new Error("CVV invalido");
      if (!cardholderName.trim()) throw new Error("Nome no cartao obrigatorio");

      // 2. Tokeniza via API do MP (client-side, seguro, PCI-compliant)
      const token = await tokenizeCard({
        cardNumber: cleanNumber,
        securityCode,
        expirationMonth: expiryMonth.padStart(2, "0"),
        expirationYear: expiryYear,
        cardholderName: cardholderName.trim(),
        identificationType: "CPF",
        identificationNumber: customerCpf.replace(/\D/g, ""),
      });

      // 3. Envia pro backend criar a payment com o token
      const detectedBrand = detectBrand(cleanNumber);
      const res = await fetch("/api/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "card",
          token,
          installments,
          // Se nao detectou a bandeira, deixa o MP descobrir pelo BIN
          paymentMethodId: detectedBrand === "unknown" ? undefined : detectedBrand,
          amount,
          planId,
          planName,
          trialDays, // 0 = pay now, >0 = trial (capture: false)
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            cpf: customerCpf,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Pagamento rejeitado");
      }

      setResult({
        status: data.status,
        status_detail: data.status_detail,
        paymentId: data.paymentId,
      });

      if (data.status === "approved") {
        setTimeout(() => {
          window.location.href = `/checkout/success?payment_id=${data.paymentId}&status=approved&trial=${trialDays > 0 ? "1" : "0"}`;
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  }

  // ============ SUBMIT PIX ============
  async function handlePixSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "pix",
          amount,
          planId,
          planName,
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            cpf: customerCpf,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha ao gerar PIX");
      }

      setPixData({
        paymentId: data.paymentId,
        qrCodeBase64: data.qrCodeBase64,
        qrCodeText: data.qrCodeText,
      });
      setPixPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  }

  // ============ Computed values ============
  // Data em que a cobranca do trial sera feita (trialDays a partir de hoje)
  const trialChargeDate = (() => {
    if (trialDays <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + trialDays);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  })();

  // Data limite pra cancelar sem ser cobrado (1 dia antes)
  const trialCancelDeadline = (() => {
    if (trialDays <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + trialDays - 1);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  })();

  // ============ POLL PIX STATUS ============
  useEffect(() => {
    if (!pixData || !pixPolling) return;
    if (result?.status === "approved") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/process-payment/status?payment_id=${pixData.paymentId}`
        );
        const data = await res.json();

        if (data.status === "approved") {
          setResult({ status: "approved", paymentId: pixData.paymentId });
          setPixPolling(false);
          setTimeout(() => {
            window.location.href = `/checkout/success?payment_id=${pixData.paymentId}&status=approved`;
          }, 1500);
        } else if (data.status === "rejected") {
          setResult({ status: "rejected", paymentId: pixData.paymentId });
          setPixPolling(false);
        }
      } catch {
        // Silencia erro de polling, tenta de novo
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pixData?.paymentId, pixPolling, result?.status]);

  // Countdown visual pro proximo check
  useEffect(() => {
    if (!pixPolling) return;
    setPixCountdown(3);
    const t = setInterval(() => {
      setPixCountdown((c) => (c <= 1 ? 3 : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [pixPolling]);

  // ============ COPY QR CODE ============
  async function copyPixCode() {
    if (!pixData?.qrCodeText) return;
    try {
      await navigator.clipboard.writeText(pixData.qrCodeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }

  // ============ INSTALLMENTS OPTIONS ============
  const installmentOptions = Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
    const valuePerInstallment = amount / n;
    return {
      n,
      value: valuePerInstallment,
      label: n === 1
        ? `1x R$ ${valuePerInstallment.toFixed(2).replace(".", ",")} à vista`
        : `${n}x R$ ${valuePerInstallment.toFixed(2).replace(".", ",")} sem juros`,
    };
  });

  const formatPrice = (n: number) =>
    n.toFixed(2).replace(".", ",");

  // ============ RENDER ============
  return (
    <div>
      {/* Method selector — PIX fica escondido quando trialDays > 0
          (PIX e pagamento instantaneo, nao da pra adiar 7 dias) */}
      <div className={`grid gap-2 mb-5 ${trialDays > 0 ? "grid-cols-1" : "grid-cols-2"}`}>
        <button
          onClick={() => setMethod("card")}
          className={`p-3.5 rounded-2xl border-2 transition flex items-center gap-2.5 ${
            method === "card"
              ? "border-green-600 bg-gradient-to-br from-green-50 to-emerald-50"
              : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              method === "card" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            <CreditCard size={18} />
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              Cartão
              {trialDays > 0 && (
                <span className="bg-green-600 text-white text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded">
                  {trialDays} DIAS GRÁTIS
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500">
              {trialDays > 0
                ? `Cobra só em ${trialDays} dias`
                : "Crédito ou débito"}
            </div>
          </div>
        </button>
        {trialDays <= 0 && (
          <button
            onClick={() => setMethod("pix")}
            className={`p-3.5 rounded-2xl border-2 transition flex items-center gap-2.5 ${
              method === "pix"
                ? "border-green-600 bg-gradient-to-br from-green-50 to-emerald-50"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                method === "pix" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 6.5L12 12l7-5.5L12 1 5 6.5zM5 17.5L12 23l7-5.5L12 12 5 17.5zM12 13.5L5 8v8l7-2.5zM19 8L12 13.5 19 16V8z" />
              </svg>
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1">
                PIX <span className="bg-green-600 text-white text-[8px] font-bold tracking-wider px-1 py-0.5 rounded">5% OFF</span>
              </div>
              <div className="text-[10px] text-slate-500">Aprovação na hora</div>
            </div>
          </button>
        )}
      </div>

      {/* Error global */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 flex-1">
            <strong>Erro:</strong> {error}
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ============ CARD FORM ============ */}
      {method === "card" && !result && (
        <form onSubmit={handleCardSubmit} className="space-y-3">
          {/* Banner do trial — so aparece quando trialDays > 0 */}
          {trialDays > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4 mb-2">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="text-sm flex-1">
                  <strong className="text-green-900 block mb-1">
                    Sem cobrança hoje.
                  </strong>
                  <p className="text-green-800 leading-relaxed">
                    Vamos cobrar{" "}
                    <strong>R$ {formatPrice(amount)}</strong> no seu cartão
                    apenas em{" "}
                    <strong>{trialChargeDate}</strong> ({trialDays} dias).
                  </p>
                  <ul className="text-xs text-green-700 mt-2 space-y-1">
                    <li>✓ Te avisaremos UM dia antes pelo WhatsApp</li>
                    <li>✓ Cancele até {trialCancelDeadline} e nada será cobrado</li>
                    <li>✓ Sem multa, sem ligação pra central</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Número do cartão
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                className="w-full border border-slate-200 rounded-xl pl-4 pr-32 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
              />
              {currentBrand.name && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                  {currentBrand.logo ? (
                    currentBrand.logo
                  ) : (
                    <div
                      className={`rounded-md ${currentBrand.bg} text-white text-[10px] font-extrabold flex items-center justify-center tracking-tight px-2.5 py-1.5 shadow-sm`}
                    >
                      {currentBrand.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nome impresso no cartão
            </label>
            <input
              type="text"
              required
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
              placeholder="MARIA SILVA"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition uppercase"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mês</label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={2}
                value={expiryMonth}
                onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, ""))}
                placeholder="12"
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-center focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ano</label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={2}
                value={expiryYear}
                onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, ""))}
                placeholder="30"
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-center focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">CVV</label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={4}
                value={securityCode}
                onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123"
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm text-center focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Parcelas
            </label>
            <div className="relative">
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition appearance-none bg-white"
              >
                {installmentOptions.map((opt) => (
                  <option key={opt.n} value={opt.n}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Checkbox de aceite do trial — obrigatorio quando trialDays > 0 */}
          {trialDays > 0 && <TrialAcceptance trialDays={trialDays} amount={amount} />}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-green-600/25 transition flex items-center justify-center gap-2 text-[15px] mt-4"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processando...
              </>
            ) : trialDays > 0 ? (
              <>
                <Sparkles size={17} strokeWidth={2.4} />
                Começar trial grátis de {trialDays} dias
              </>
            ) : (
              <>
                <Lock size={17} strokeWidth={2.4} />
                Pagar R$ {formatPrice(amount)}
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1">
            <Shield size={11} />
            <span>Criptografia ponta-a-ponta · PCI-DSS</span>
          </div>
        </form>
      )}

      {/* ============ PIX FORM ============ */}
      {method === "pix" && !result && !pixData && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 text-center">
            <div className="text-[10px] font-bold tracking-widest text-green-700 uppercase mb-1">
              Economize 5%
            </div>
            <div className="text-2xl font-extrabold text-green-900">
              R$ {formatPrice(amount * 0.95)}
            </div>
            <div className="text-xs text-green-700 mt-1">
              no PIX · aprovação instantânea
            </div>
          </div>

          <button
            onClick={handlePixSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-br from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-green-600/25 transition flex items-center justify-center gap-2 text-[15px]"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Gerando QR Code...
              </>
            ) : (
              <>
                <Zap size={18} strokeWidth={2.4} />
                Gerar QR Code PIX
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400 text-center mt-3">
            O QR Code expira em 30 minutos. Paga com o app do seu banco.
          </p>
        </div>
      )}

      {/* ============ PIX QR CODE VIEW ============ */}
      {method === "pix" && pixData && !result && (
        <div className="text-center">
          {/* QR Code */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 mb-4 inline-block mx-auto">
            {pixData.qrCodeBase64 ? (
              <img
                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                alt="QR Code PIX"
                className="w-56 h-56"
              />
            ) : (
              <div className="w-56 h-56 bg-slate-100 rounded-lg flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" />
              </div>
            )}
          </div>

          <p className="text-sm font-semibold text-slate-900 mb-1">
            Escaneie o QR Code com o app do seu banco
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Ou copie o código abaixo e cole no app
          </p>

          {/* Copia e cola */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-4 flex items-center gap-2">
            <code className="flex-1 text-[10px] text-slate-600 font-mono truncate text-left">
              {pixData.qrCodeText}
            </code>
            <button
              onClick={copyPixCode}
              className="shrink-0 bg-white border border-slate-200 hover:border-green-600 hover:text-green-700 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copied ? (
                <>
                  <Check size={12} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={12} /> Copiar
                </>
              )}
            </button>
          </div>

          {/* Status de espera */}
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 size={14} className="animate-spin text-green-600" />
            <span>
              Aguardando pagamento
              {pixCountdown > 0 && (
                <span className="text-slate-400"> · checando em {pixCountdown}s</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* ============ RESULT (aprovado/rejeitado) ============ */}
      {result && (
        <div className="text-center py-4">
          {result.status === "approved" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 size={36} className="text-green-600" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-1">
                Pagamento aprovado!
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Redirecionando pro WhatsApp da Fity...
              </p>
              <Loader2 className="animate-spin text-green-600 mx-auto" />
            </>
          ) : result.status === "rejected" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 mx-auto flex items-center justify-center mb-3">
                <AlertCircle size={36} className="text-red-600" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-1">
                Pagamento rejeitado
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {result.status_detail || "Tente outro método de pagamento."}
              </p>
              <button
                onClick={() => {
                  setResult(null);
                  setPixData(null);
                  setPixPolling(false);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-xl text-sm"
              >
                Tentar novamente
              </button>
            </>
          ) : (
            <div className="py-4">
              <Loader2 className="animate-spin text-green-600 mx-auto mb-2" size={32} />
              <p className="text-sm text-slate-500">
                Processando pagamento...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =================================================================
// TrialAcceptance — checkbox de aceite do trial (obrigatorio)
// Renderiza antes do botao de submit. So aparece se trialDays > 0.
// =================================================================
function TrialAcceptance({
  trialDays,
  amount,
}: {
  trialDays: number;
  amount: number;
}) {
  return (
    <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-green-300 transition mt-3">
      <input
        type="checkbox"
        required
        className="mt-0.5 w-4 h-4 accent-green-600 shrink-0"
      />
      <span className="text-xs text-slate-700 leading-relaxed">
        Estou ciente de que meu cartão será cobrado{" "}
        <strong className="text-slate-900">
          em R$ {amount.toFixed(2).replace(".", ",")}
        </strong>{" "}
        após <strong className="text-slate-900">{trialDays} dias</strong> caso
        eu não cancele antes. Vou receber um aviso no WhatsApp UM dia antes da
        cobrança.
      </span>
    </label>
  );
}
