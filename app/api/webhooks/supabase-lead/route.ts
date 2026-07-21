import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTemplateMessage } from "@/lib/whatsapp";

// =================================================================
// FITY — Webhook: novo lead no Supabase → cria user + manda Zap
// =================================================================
// Como funciona:
// 1. Supabase detecta INSERT na tabela "leads"
// 2. Supabase faz POST pra essa URL com payload JSON
// 3. Esse handler: cria o user correspondente + dispara Zap de boas-vindas
//
// Onde cadastrar a URL:
// - Supabase → Database → Webhooks → Create
// - Table: leads
// - Events: INSERT
// - URL: https://<seu-dominio>/api/webhooks/supabase-lead
// =================================================================

// Formato do payload que o Supabase envia
type SupabaseWebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    goal?: string | null;
    created_at?: string;
  } | null;
  old_record: unknown | null;
};

export async function POST(req: Request) {
  const startedAt = Date.now();

  // ============================================================
  // 1. SEGURANÇA OPCIONAL — valida o header x-webhook-secret
  // ============================================================
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Webhook secret invalido" },
        { status: 401 }
      );
    }
  }

  // ============================================================
  // 2. PARSEA O PAYLOAD
  // ============================================================
  let payload: SupabaseWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Payload invalido (nao e JSON)" },
      { status: 400 }
    );
  }

  // Log estruturado pra debug
  console.log("[webhook supabase-lead] recebido:", {
    type: payload.type,
    table: payload.table,
    recordId: payload.record?.id,
  });

  // ============================================================
  // 3. SÓ PROCESSA INSERT NA TABELA LEADS
  // ============================================================
  if (payload.type !== "INSERT" || payload.table !== "leads" || !payload.record) {
    // Retorna 200 mesmo assim (Supabase nao retenta o que nao e relevante)
    return NextResponse.json({
      ok: true,
      skipped: true,
      motivo: `Ignorado: type=${payload.type}, table=${payload.table}`,
    });
  }

  const lead = payload.record;
  const phone = lead.whatsapp.replace(/\D/g, ""); // limpa formatacao
  const firstName = (lead.name || "").split(" ")[0] || "amigo";

  // Validação mínima
  if (!lead.name || phone.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Lead sem nome ou telefone valido" },
      { status: 400 }
    );
  }

  // ============================================================
  // 4. CRIA USER NO SUPABASE (se ainda nao existir)
  // ============================================================
  let userId: string;
  let userCreated = false;

  // 4a. Verifica se ja existe user com esse telefone
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    // User ja existe — so atualiza o lead_id pra linkar
    userId = existing.id;
    await supabaseAdmin
      .from("users")
      .update({ lead_id: lead.id, name: lead.name })
      .eq("id", userId);
  } else {
    // Cria novo user
    const { data: created, error: createErr } = await supabaseAdmin
      .from("users")
      .insert({
        lead_id: lead.id,
        phone,
        name: lead.name,
        onboarding_completed: false,
        onboarding_step: "start",
      })
      .select("id")
      .single();

    if (createErr || !created) {
      console.error("[webhook] erro ao criar user:", createErr);
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao criar user",
          detalhes: createErr?.message,
        },
        { status: 500 }
      );
    }

    userId = created.id;
    userCreated = true;
  }

  // ============================================================
  // 5. MONTA E ENVIA A MENSAGEM DE BOAS-VINDAS NO ZAP
  // ============================================================
  const goalText = lead.goal
    ? `comecar com o Fity pra *${lead.goal}*`
    : "testar o Fity";

  const welcomeMessage = `Fala, *${firstName}*! 👋

Vi que voce quer ${goalText}. Massa!

Sou o *Fity*, teu personal trainer IA. A partir de agora a gente funciona assim:

✅ Todo dia 7h: briefing com treino + refeicoes
📅 Sabado: lista de compras da semana
🔄 Voce responde no Zap que eu adapto tudo

Pra comecar, me conta: *qual teu objetivo principal?*

1️⃣ Emagrecer
2️⃣ Ganhar massa muscular
3️⃣ Saude e qualidade de vida
4️⃣ Performance atletica
5️⃣ Recomecar do zero

Responde so o numero! 💚`;

  // 5b. Envia template "welcome_lead" (Meta Cloud API)
  //     Template precisa estar criado e aprovado na Meta.
  //     Variavel: {{1}} = primeiro nome (ja calculado acima)
  const whatsappResult = await sendTemplateMessage(
    phone,
    "welcome_lead",
    "pt_BR",
    [firstName]
  );

  // ============================================================
  // 6. RETORNA PRO SUPABASE
  // IMPORTANTE: sempre retorna 200 (a menos que erro grave)
  // Se retornar erro, o Supabase retenta — e nao queremos enviar Zap 2x
  // ============================================================
  const duration = Date.now() - startedAt;

  if (!whatsappResult.ok) {
    // User foi criado mas Zap falhou — loga o erro mas retorna 200
    console.error("[webhook] Zap falhou:", whatsappResult.error);
    return NextResponse.json({
      ok: true,
      aviso: "User criado, mas Zap falhou. Reenvie manualmente.",
      userId,
      leadId: lead.id,
      userCreated,
      whatsapp: { ok: false, error: whatsappResult.error },
      duration_ms: duration,
    });
  }

  console.log(`[webhook] Zap enviado! userId=${userId} messageId=${whatsappResult.messageId}`);

  return NextResponse.json({
    ok: true,
    userId,
    leadId: lead.id,
    userCreated,
    whatsapp: {
      ok: true,
      messageId: whatsappResult.messageId,
      phone: whatsappResult.phone,
    },
    duration_ms: duration,
  });
}

// GET simples pra você poder testar que a rota tá no ar
export async function GET() {
  return NextResponse.json({
    ok: true,
    rota: "/api/webhooks/supabase-lead",
    metodo_esperado: "POST",
    como_testar: [
      "1. Configure o webhook no Supabase (veja instrucoes)",
      "2. Faca um INSERT na tabela 'leads' (via form ou SQL)",
      "3. A mensagem de boas-vindas chega no Zap do lead",
    ],
  });
}