import { NextResponse } from "next/server";
import { sendTemplateMessage } from "@/lib/whatsapp";
import { supabaseAdmin } from "@/lib/supabase-admin";

// =================================================================
// FITY — Webhook Mercado Pago → dispara WhatsApp via Meta Cloud API
// =================================================================
// Fluxo:
// 1. Recebe POST do MP (notificacao de pagamento)
// 2. Extrai ID do pagamento (data.id ou resource URL)
// 3. Confirma se e pagamento (type/topic comeca com "payment")
// 4. GET em /v1/payments/{id} pra ver o status REAL (nao confia no payload)
// 5. Se status === "approved", dispara template "welcome_fity_2" via Meta
//
// REGRA DE OURO: sempre retorna 200, mesmo com erro. SENAO o MP fica
// reenviando a mesma notificacao infinitamente e a gente toma rate limit.
// =================================================================

// Token do MP (sistema). Aceita MERCADOPAGO_ACCESS_TOKEN (padrao) ou
// MP_ACCESS_TOKEN (legado, mesmo valor).
const MP_TOKEN =
  process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;

const MP_API_BASE = "https://api.mercadopago.com/v1/payments";

// Template que sera disparado apos pagamento aprovado.
const WELCOME_TEMPLATE = "welcome_fity";
const WELCOME_LANGUAGE = "pt_BR"; // OBRIGATORIO ser exato - template foi aprovado em pt_BR

export async function POST(req: Request) {
  const startedAt = Date.now();
  console.log("\n========== [mp-webhook] NOVA NOTIFICACAO ==========");

  // ============================================================
  // 1. GUARDA DE SEGURANCA: token configurado
  // ============================================================
  if (!MP_TOKEN) {
    console.error("[mp-webhook] ERRO: MERCADOPAGO_ACCESS_TOKEN ausente no .env.local");
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 200 });
  }

  // ============================================================
  // 2. PARSE DO BODY
  // ============================================================
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    console.warn("[mp-webhook] body nao era JSON valido, ignorando");
    return NextResponse.json({ ok: true, ignored: "no_body" }, { status: 200 });
  }

  console.log(
    "[mp-webhook] payload recebido:",
    JSON.stringify(body).slice(0, 300)
  );

  // ============================================================
  // 3. EXTRAI ID DO PAGAMENTO + TIPO DO EVENTO
  // ============================================================
  // O MP manda em 2 formatos:
  //   v2 (novo): { type: "payment", data: { id: "123" } }
  //   v1 (legado): { topic: "payment", resource: "https://...?/payments/123" }

  const eventType: string =
    body?.type ||
    body?.topic ||
    body?.action ||
    "";

  const paymentId: string | undefined =
    body?.data?.id?.toString() ||
    (typeof body?.resource === "string"
      ? body.resource.split("/").pop()
      : undefined) ||
    body?.id?.toString();

  console.log(`[mp-webhook] eventType="${eventType}" paymentId="${paymentId}"`);

  // Filtra: so processa evento de pagamento
  if (eventType && !eventType.toLowerCase().startsWith("payment")) {
    console.log(`[mp-webhook] evento ignorado (nao e pagamento): ${eventType}`);
    return NextResponse.json(
      { ok: true, ignored: eventType },
      { status: 200 }
    );
  }

  if (!paymentId) {
    console.warn("[mp-webhook] sem paymentId, ignorando");
    return NextResponse.json(
      { ok: true, ignored: "no_payment_id" },
      { status: 200 }
    );
  }

  // ============================================================
  // 4. CONSULTA API DO MP PRA CONFIRMAR STATUS REAL
  //    (NUNCA confia no payload do webhook - sempre valida via API)
  // ============================================================
  console.log(`[mp-webhook] consultando pagamento ${paymentId} no MP...`);

  let payment: any;
  try {
    const res = await fetch(`${MP_API_BASE}/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errTxt = await res.text();
      console.error(
        `[mp-webhook] MP retornou ${res.status} ao consultar ${paymentId}: ${errTxt.slice(0, 200)}`
      );
      return NextResponse.json(
        {
          ok: false,
          error: "mp_lookup_failed",
          statusCode: res.status,
          paymentId,
        },
        { status: 200 }
      );
    }

    payment = await res.json();
  } catch (err) {
    console.error(`[mp-webhook] ERRO de rede ao consultar MP:`, err);
    return NextResponse.json(
      {
        ok: false,
        error: "mp_network_error",
        paymentId,
        message: err instanceof Error ? err.message : "erro desconhecido",
      },
      { status: 200 }
    );
  }

  // ============================================================
  // 5. VERIFICA SE FOI APROVADO
  // ============================================================
  const status: string = payment?.status || "unknown";
  console.log(
    `[mp-webhook] pagamento ${paymentId} status=${status} (${payment?.status_detail || "sem detalhe"})`
  );

  if (status !== "approved") {
    return NextResponse.json(
      {
        ok: true,
        paymentId,
        status,
        action: "ignored_not_approved",
      },
      { status: 200 }
    );
  }

  // ============================================================
  // 6. EXTRAI DADOS DO CLIENTE DO METADATA
  //    O checkout process-payment envia phone e name no metadata
  // ============================================================
  const metadata = payment?.metadata || {};
  const customerName: string =
    metadata.customer_name || metadata.name || "amigo(a)";
  const customerPhone: string = metadata.customer_phone || metadata.phone || "";

  console.log(
    `[mp-webhook] cliente: nome="${customerName}" phone="${customerPhone}"`
  );

  if (!customerPhone) {
    console.error(
      `[mp-webhook] pagamento ${paymentId} aprovado mas SEM phone no metadata`
    );
    return NextResponse.json(
      {
        ok: false,
        error: "no_phone_in_metadata",
        paymentId,
        metadata,
      },
      { status: 200 }
    );
  }

  // ============================================================
  // 6.5. RENOVACAO: estende expires_at do customer se ele ja existe
  //      Logica:
  //        - Se tem trial/customer com esse email E status captured/paused/expired
  //          -> RENOVACAO: estende expires_at (renovacao manual mensal)
  //        - Se nao tem trial ainda
  //          -> Cria novo registro (novo user via paynow direto)
  //        - Em qualquer caso, garante que expires_at = now + 30 dias
  //      O trial_ending cron depois manda o aviso 1 dia antes do novo expires_at.
  // ============================================================
  const customerEmail: string =
    metadata.customer_email || metadata.email || "";
  const planId: string = metadata.plan_id || payment?.external_reference || "pro";
  const planName: string = metadata.plan_name || "Fity Pro";
  const amount: number = payment?.transaction_amount || 49.0;

  if (customerEmail) {
    try {
      const { data: existingTrial, error: lookupErr } = await supabaseAdmin
        .from("trials")
        .select("id, status, expires_at")
        .eq("customer_email", customerEmail)
        .in("status", ["captured", "paused", "expired"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupErr) {
        console.error(
          "[mp-webhook] erro ao buscar trial existente por email:",
          lookupErr
        );
      } else if (existingTrial) {
        // RENOVACAO: estende a data de expiracao
        // Pega o maior entre expires_at atual e agora (pra nao "voltar no tempo"
        // se pagar atrasado), e soma 30 dias.
        const baseDate = existingTrial.expires_at
          ? new Date(existingTrial.expires_at)
          : new Date();
        const nowDate = new Date();
        const startDate = baseDate > nowDate ? baseDate : nowDate;
        const newExpiresAt = new Date(startDate);
        newExpiresAt.setDate(newExpiresAt.getDate() + 30);

        const { error: updateErr } = await supabaseAdmin
          .from("trials")
          .update({
            status: "captured",
            expires_at: newExpiresAt.toISOString(),
            captured_at: nowDate.toISOString(),
            renewal_reminder_sent: false,
            paused_at: null, // limpa paused_at
            // atualiza tambem dados do pagamento (rastreabilidade)
            payment_id: Number(paymentId),
            amount: amount,
            plan_id: planId,
            plan_name: planName,
          })
          .eq("id", existingTrial.id);

        if (updateErr) {
          console.error(
            "[mp-webhook] erro ao atualizar trial na renovacao:",
            updateErr
          );
        } else {
          console.log(
            `[mp-webhook] RENOVACAO: trial ${existingTrial.id} estendido expires_at=${newExpiresAt.toISOString()}`
          );
        }
      } else {
        // NOVO USER via paynow=1 (sem trial anterior): cria registro
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 30);

        const { error: insertErr } = await supabaseAdmin.from("trials").insert({
          payment_id: Number(paymentId),
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          customer_cpf: metadata.customer_cpf || null,
          plan_id: planId,
          plan_name: planName,
          amount: amount,
          status: "captured",
          captured_at: new Date().toISOString(),
          expires_at: newExpiresAt.toISOString(),
          renewal_reminder_sent: false,
          created_at: new Date().toISOString(),
        });

        if (insertErr) {
          console.error(
            "[mp-webhook] erro ao criar trial novo:",
            insertErr
          );
        } else {
          console.log(
            `[mp-webhook] NOVO USER via paynow: trial criado expires_at=${newExpiresAt.toISOString()}`
          );
        }
      }
    } catch (dbErr) {
      console.error("[mp-webhook] erro geral na logica de renovacao:", dbErr);
      // Nao bloqueia o envio do WhatsApp — webhook segue
    }
  } else {
    console.warn(
      "[mp-webhook] pagamento aprovado sem email no metadata — logica de renovacao pulada"
    );
  }

  // ============================================================
  // 7. DISPARA WHATSAPP VIA META CLOUD API (template welcome_fity)
  //    Variaveis: [nome, plano, preco]
  //    Espera a aprovacao da Meta antes de funcionar.
  // ============================================================
  console.log(
    `[mp-webhook] disparando template ${WELCOME_TEMPLATE} pra ${customerPhone}...`
  );

  const whatsappResult = await sendTemplateMessage(
    customerPhone,
    WELCOME_TEMPLATE,
    WELCOME_LANGUAGE,
    [customerName, "Fity Pro", "49,00"]
  );

  if (!whatsappResult.ok) {
    console.error(
      `[mp-webhook] FALHA ao enviar WhatsApp: ${whatsappResult.error}`
    );
    return NextResponse.json(
      {
        ok: false,
        paymentId,
        whatsappError: whatsappResult.error,
        action: "payment_approved_but_whatsapp_failed",
      },
      { status: 200 }
    );
  }

  // ============================================================
  // 8. SUCESSO
  // ============================================================
  const duration = Date.now() - startedAt;
  console.log(
    `[mp-webhook] OK SUCESSO: pagamento ${paymentId} -> WhatsApp enviado pra ${customerPhone} (msg ${whatsappResult.messageId}) em ${duration}ms`
  );

  return NextResponse.json(
    {
      ok: true,
      paymentId,
      status: "approved",
      whatsappSent: true,
      messageId: whatsappResult.messageId,
      duration_ms: duration,
    },
    { status: 200 }
  );
}

// GET: info da rota (util pra testar se o webhook ta respondendo)
export async function GET() {
  return NextResponse.json({
    ok: true,
    rota: "/api/webhooks/mercadopago",
    metodo_esperado: "POST",
    quem_chama: "Mercado Pago (notificacoes de pagamento)",
    fluxo: [
      "1. Recebe POST do MP",
      "2. Extrai ID do pagamento do payload (data.id ou resource URL)",
      "3. Filtra: so processa se for evento de pagamento",
      "4. GET em /v1/payments/{id} pra confirmar status real",
      "5. Se aprovado E tiver phone no metadata -> dispara template",
      "6. SEMPRE retorna 200 (mesmo em erro) pra MP parar de retentar",
    ],
    config: {
      template: WELCOME_TEMPLATE,
      language: WELCOME_LANGUAGE,
      token_env: "MERCADOPAGO_ACCESS_TOKEN (ou MP_ACCESS_TOKEN)",
    },
  });
}
