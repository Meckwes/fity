import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// =================================================================
// FITY — API: processa pagamento direto (cartao tokenizado OU PIX)
// =================================================================
// NAO usa Brick. NAO usa preference. Cria a payment direto via
// /v1/payments do Mercado Pago.
//
// Dois fluxos:
//   1. CARTAO: recebe token ja tokenizado (via createCardToken no client)
//      e cria a payment com ele.
//      - Com trialDays > 0: capture=false (so autoriza, nao cobra)
//      - Sem trial: capture=true (cobra agora)
//   2. PIX: cria a payment com payment_method_id=pix, retorna QR code.
//      PIX NAO suporta trial (pagamento e instantaneo).
//
// IMPORTANTE: o email do payer em SANDBOX precisa ser um test user
// registrado no painel MP. Configura em .env.local:
//   MP_DEV_PAYER_EMAIL=test_user_xxxxx@testuser.com
//
// Em PRODUCAO usa o email do cliente direto (sem fallback).
//
// NOTA: card tokens do MP sao de USO UNICO. Se a chamada falhar (por
// qualquer motivo: 4xx, 5xx, network error), o token JA FOI CONSUMIDO
// e NAO PODE ser reutilizado. Por isso NAO fazemos retry - a UI gera
// um novo token via SDK no client se precisar.
// =================================================================

export const dynamic = "force-dynamic";

type CardPayload = {
  method: "card";
  token: string;
  installments: number;
  paymentMethodId?: string;
  issuerId?: string;
  amount: number;
  planId: string;
  planName: string;
  trialDays?: number; // 0 = pay now, >0 = trial (capture: false)
  customer: {
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
  };
};

type PixPayload = {
  method: "pix";
  amount: number;
  planId: string;
  planName: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
  };
};

type Payload = CardPayload | PixPayload;

// Gera X-Idempotency-Key (evita double-charge em retry de rede)
function makeIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Decide qual email usar como payer.email
// IMPORTANTE: usa SEMPRE o email que o usuario digitou no form (customerEmail).
// Nao fazemos substituicao por test user aqui - o backend do Mercado Pago
// recebe o email real do cliente. Se for sandbox e o email nao for de
// test user registrado, o MP retorna 403 ("Payer email forbidden") e a
// gente ve o erro exato pra debugar.
function getPayerEmail(customerEmail: string): string {
  // Log pra debug: mostra exatamente qual email vai pro MP
  console.log(`[process-payment] payer.email = ${customerEmail} (do form)`);
  return customerEmail;
}

// Divide nome em first/last
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "MP_ACCESS_TOKEN nao configurado" },
        { status: 500 }
      );
    }

    const payload = (await req.json()) as Payload;

    // Validacao basica
    if (!payload.amount || payload.amount <= 0) {
      return NextResponse.json({ error: "amount invalido" }, { status: 400 });
    }
    if (!payload.customer?.email) {
      return NextResponse.json({ error: "customer.email obrigatorio" }, { status: 400 });
    }
    if (!payload.customer?.name) {
      return NextResponse.json({ error: "customer.name obrigatorio" }, { status: 400 });
    }

    const payerEmail = getPayerEmail(payload.customer.email);
    const { firstName, lastName } = splitName(payload.customer.name);

    // ============ MONTA PAYLOAD DA PAYMENT ============
    // MP exige notification_url como URL publica/HTTPS valida. Em dev
    // (localhost) o MP rejeita com "notificaction_url attribute must be
    // url valid". Entao so enviamos o campo em producao.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const isPublicUrl =
      !baseUrl.includes("localhost") &&
      !baseUrl.includes("127.0.0.1") &&
      baseUrl.startsWith("https://");

    let paymentBody: any = {
      transaction_amount: Number(payload.amount.toFixed(2)),
      description: `Fity ${payload.planName} - mensal`,
      external_reference: payload.planId,
      metadata: {
        plan_id: payload.planId,
        plan_name: payload.planName,
        customer_name: payload.customer.name,
        customer_email: payload.customer.email,
        customer_phone: payload.customer.phone,
        customer_cpf: payload.customer.cpf,
        source: "fity_app",
      },
      payer: {
        email: payerEmail,
        first_name: firstName,
        last_name: lastName,
      },
    };

    // So adiciona notification_url em producao (HTTPS publico)
    if (isPublicUrl) {
      paymentBody.notification_url = `${baseUrl}/api/webhooks/mercadopago`;
    }

    if (payload.customer.cpf) {
      paymentBody.payer.identification = {
        type: "CPF",
        number: payload.customer.cpf.replace(/\D/g, ""),
      };
    }

    if (payload.method === "card") {
      if (!payload.token) {
        return NextResponse.json(
          { error: "token do cartao obrigatorio" },
          { status: 400 }
        );
      }
      paymentBody.token = payload.token;
      paymentBody.installments = payload.installments || 1;
      // So envia payment_method_id se for um valor valido
      const validBrands = ["visa", "master", "amex", "elo", "hipercard", "mc"];
      if (payload.paymentMethodId && validBrands.includes(payload.paymentMethodId)) {
        paymentBody.payment_method_id = payload.paymentMethodId;
      }
      if (payload.issuerId) {
        paymentBody.issuer_id = payload.issuerId;
      }

      // Trial: capture=false autoriza mas nao cobra. A captura real
      // acontece depois via cron. PIX nao suporta trial.
      const trialDays = (payload as CardPayload).trialDays ?? 0;
      if (trialDays > 0) {
        paymentBody.capture = false;
        // MP exige que o amount de capture=false seja o MESMO do capture
        // (ou menor, mas a mesma transaction_amount). E suportado.
      }
    } else if (payload.method === "pix") {
      // PIX nao suporta trial — pagamento e instantaneo
      paymentBody.payment_method_id = "pix";
    } else {
      return NextResponse.json(
        { error: "method invalido (card ou pix)" },
        { status: 400 }
      );
    }

    // Log do body
    console.log(
      "[process-payment] paymentBody:",
      JSON.stringify(paymentBody, null, 2)
    );

    // ============ CHAMA API DO MP (uma unica tentativa) ============
    // SEM RETRY: card tokens do MP sao de uso unico. Se a chamada
    // falhar, o token ja foi consumido. A UI gera um novo token se
    // precisar tentar de novo.
    console.log(
      `[process-payment] criando payment unica (amount=${paymentBody.transaction_amount}, method=${paymentBody.payment_method_id || "card"}, payer=${payerEmail})`
    );

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": makeIdempotencyKey(),
      },
      body: JSON.stringify(paymentBody),
    });

    // Parse da resposta (sempre JSON, mesmo em erro)
    let mpData: any = null;
    const responseText = await mpResponse.text();
    try {
      mpData = JSON.parse(responseText);
    } catch {
      mpData = { raw: responseText };
    }

    // ============ ERRO DO MP (log detalhado + retorno) ============
    if (!mpResponse.ok) {
      // Log COMPLETO do erro pra debug - mostra TUDO que o MP devolveu
      console.error(
        `[process-payment] MP REJEITOU payment (HTTP ${mpResponse.status}):`
      );
      console.error(JSON.stringify(mpData, null, 2));

      // Extrai info util do erro
      const errorMsg = mpData?.message || `MP retornou HTTP ${mpResponse.status}`;
      const statusDetail = mpData?.status_detail;
      const causes = mpData?.cause || [];

      return NextResponse.json(
        {
          ok: false,
          error: errorMsg,
          status_detail: statusDetail,
          causes: causes,
          mp_status: mpResponse.status,
          mp_error_code: mpData?.error,
          raw: mpData, // inclui o response completo pra debug
          duration_ms: Date.now() - startedAt,
        },
        { status: mpResponse.status }
      );
    }

    // ============ SUCESSO ============
    console.log(
      `[process-payment] ✅ payment criada: ${mpData.id} status=${mpData.status} em ${Date.now() - startedAt}ms`
    );

    const response: any = {
      ok: true,
      paymentId: mpData.id,
      status: mpData.status,
      status_detail: mpData.status_detail,
      duration_ms: Date.now() - startedAt,
    };

    // Se for PIX, retorna o QR code
    if (payload.method === "pix" && mpData.point_of_interaction?.transaction_data) {
      const txData = mpData.point_of_interaction.transaction_data;
      response.qrCodeBase64 = txData.qr_code_base64;
      response.qrCodeText = txData.qr_code;
      response.expiresAt = txData.expiration_date;
    }

    // ============ SALVA TRIAL NO SUPABASE (se for trial) ============
    // Pra trial de cartao: MP criou a payment com capture=false (status=authorized).
    // Salvamos na tabela trials pra o cron diario poder capturar depois.
    const isTrial =
      payload.method === "card" &&
      (payload as CardPayload).trialDays &&
      (payload as CardPayload).trialDays! > 0 &&
      mpData.status === "authorized"; // capture=false retorna status=authorized

    if (isTrial) {
      const trialDays = (payload as CardPayload).trialDays!;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + trialDays);

      console.log(
        `[process-payment] salvando trial: paymentId=${mpData.id} endDate=${endDate.toISOString()}`
      );

      const { error: trialErr } = await supabaseAdmin.from("trials").insert({
        payment_id: mpData.id,
        customer_name: payload.customer.name,
        customer_email: payload.customer.email,
        customer_phone: payload.customer.phone || null,
        customer_cpf: payload.customer.cpf || null,
        plan_id: payload.planId,
        plan_name: payload.planName,
        amount: payload.amount,
        start_date: startDate.toISOString(),
        charge_date: endDate.toISOString(), // quando vai cobrar de verdade
        reminder_date: new Date(endDate.getTime() - 24 * 60 * 60 * 1000).toISOString(), // 1 dia antes
        status: "active", // active | captured | cancelled | failed
        notified_day6: false,
        created_at: new Date().toISOString(),
      });

      if (trialErr) {
        // Nao bloqueia o checkout — o user ainda tem o trial, a gente
        // pode re-extrair do MP se precisar. Mas loga pra investigar.
        console.error("[process-payment] erro ao salvar trial:", trialErr);
      } else {
        console.log(`[process-payment] trial salvo: endDate=${endDate.toISOString()}`);
        response.trial = true;
        response.chargeDate = endDate.toISOString();
      }
    }

    return NextResponse.json(response);
  } catch (err) {
    // ============ ERRO INESPERADO (rede, JSON parse, etc) ============
    // Log DETALHADO do erro pra debug
    console.error("[process-payment] ERRO INESPERADO (catch):");
    if (err instanceof Error) {
      console.error("  message:", err.message);
      console.error("  name:", err.name);
      console.error("  stack:", err.stack);
      // Se for Response-like (algumas libs do MP jogam assim)
      const anyErr = err as any;
      if (anyErr.cause) console.error("  cause:", JSON.stringify(anyErr.cause, null, 2));
      if (anyErr.response?.data)
        console.error("  response.data:", JSON.stringify(anyErr.response.data, null, 2));
      if (anyErr.response?.status)
        console.error("  response.status:", anyErr.response.status);
    } else {
      console.error("  (non-Error throw):", err);
    }

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
        error_name: err instanceof Error ? err.name : undefined,
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
