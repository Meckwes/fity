// app/api/cron/daily-briefing/route.ts
// =================================================================
// FITY — Cron diário: orquestrador + envio de briefing 7h
// =================================================================
// Dois handlers:
//
//   GET  → ORQUESTRADOR (chamado pelo Vercel Cron às 10h UTC = 7h BRT)
//           1. Pega todos os subscribers ativos via getActiveSubscribers()
//              (EXCLUI paused/expired/cancelled — definido em lib/subscription.ts)
//           2. Pra cada um: busca profile, gera briefing via Gemini, envia Zap
//           3. Retorna stats (total, generated, sent, failed, skipped)
//
//   POST → ENVIO DIRETO (testes manuais)
//           Body: { phone, nome, data, tipo_treino, briefing_texto }
//           Envia UM briefing especifico (ja gerado).
//
// SOBRE O PROFILE: a tabela `users` tem colunas basicas (name, phone, etc).
// O profile completo (weight_kg, height_cm, equipment, etc) eh populado
// pelo onboarding conversacional. Tenta ler de colunas diretas OU de
// uma coluna JSON `profile` (caso tenha sido migrada).
//
// RATE LIMIT GEMINI: tier free = 1500 req/dia. Com 50 users = OK.
// Pra 100+ users, dividir em batches ou migrar pro tier pago.
// =================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp";
import { getEligibleBriefingRecipients } from "@/lib/subscription";
import {
  generateBriefing,
  type UserProfile,
  type DailyBriefing,
} from "@/lib/ai";

// =================================================================
// GET — ORQUESTRADOR (chamado pelo Vercel Cron)
// =================================================================

// Limite de processsamento por execucao (evita timeout do Vercel Hobby = 60s)
// Gemini demora ~3-5s por user. Com 20 users = ~80s. Ajusta conforme plano.
const MAX_USERS_PER_RUN = 20;

// Helper: autentica cron
function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  // Vercel Cron manda Authorization: Bearer $CRON_SECRET
  const auth = req.headers.get("authorization");
  const expected = process.env.VERCEL_CRON_SECRET;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

// Helper: extrai UserProfile do row de `users` + row de `profiles`.
// Tabela `profiles` tem os dados fisicos (peso, altura, equipamento, etc),
// vinculada via profiles.user_id = users.id.
//
// Colunas da tabela `profiles` (mapeamento exato):
//   - user_id              → usado no JOIN
//   - goal                 → UserProfile.goal
//   - current_weight_kg    → UserProfile.weight_kg  (note: "current_" no DB)
//   - target_weight_kg     → (informativo, nao vai pro prompt)
//   - height_cm            → UserProfile.height_cm
//   - equipment            → UserProfile.equipment (text array)
//   - dietary_restrictions → UserProfile.dietary_restrictions (text array)
//   - meals_per_day        → UserProfile.meals_per_day
//   - workout_days_per_week → UserProfile.workout_days_per_week
//   - adaptation_context   → UserProfile.adaptation_context (FeedbackItem[])
//
// Campos de `users` usados:
//   - users.name           → UserProfile.name
function buildProfile(user: any, profile: any): UserProfile {
  return {
    name: user.name || "amigo(a)",
    goal: profile.goal || "saude",
    weight_kg: Number(profile.current_weight_kg || 0),
    height_cm: profile.height_cm || undefined,
    // age/sex/activity_level nao estao na tabela `profiles` por
    // enquanto — se adicionar la depois, plugar aqui.
    equipment:
      profile.equipment && profile.equipment.length > 0
        ? profile.equipment
        : ["peso corporal"],
    dietary_restrictions: profile.dietary_restrictions || [],
    // Preferencias alimentares detalhadas (gosta / nao gosta).
    // Pode ser null em profiles antigos (antes da migration de 2026-07-23).
    food_preferences: profile.food_preferences || undefined,
    meals_per_day: profile.meals_per_day || undefined,
    workout_days_per_week: profile.workout_days_per_week || undefined,
    adaptation_context: profile.adaptation_context || [],
  };
}

// Helper: formata UMA refeicao (titulo + lista de alimentos)
function formatMeal(meal: any, emoji: string, label: string): string {
  if (!meal) return `${emoji} *${label}*: —`;

  const titulo = meal.titulo || "—";
  const alimentos: string[] = Array.isArray(meal.alimentos) ? meal.alimentos : [];

  if (alimentos.length === 0) {
    // Sem alimentos (Gemini falhou nesse campo) — pelo menos mostra o titulo
    return `${emoji} *${label}*: ${titulo}`;
  }

  // Formata: titulo em negrito, depois lista de alimentos com bullets
  const itens = alimentos
    .filter((a) => a && typeof a === "string" && a.trim().length > 0)
    .map((a) => `  • ${a.trim()}`)
    .join("\n");

  return `${emoji} *${label}*: ${titulo}\n${itens}`;
}

// Helper: formata briefing JSON como texto do WhatsApp
// DEFENSIVO: lida com campos faltando / estrutura quebrada do Gemini
// (improvisa acontece mesmo com responseSchema — fallback nunca quebra)
function formatBriefingAsText(
  b: any,
  customerName: string
): string {
  // Log defensivo: dump da estrutura pra debug se algo vier errado
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[formatBriefingAsText] keys recebidas: ${Object.keys(b || {}).join(", ")}`
    );
  }

  // firstName: usa o primeiro nome, mas trata placeholder "Usuario sem nome" / "Usuario" como fallback
  const rawName = (customerName || "").trim();
  const firstName = (rawName && !/^(usuario|amigo)/i.test(rawName))
    ? rawName.split(" ")[0]
    : "amigo(a)";
  const mensagem = b?.mensagem_motivacional || "Bora pra mais um dia!";

  // Treino (defensivo — pode nao ter vindo com a estrutura esperada)
  const treino = b?.treino;
  const exercicios = Array.isArray(treino?.exercicios) ? treino.exercicios : [];
  const treinoLines =
    exercicios.length > 0
      ? exercicios
          .map(
            (e: any) =>
              `• ${e?.nome || "exercicio"}: ${e?.series ?? "?"}x${e?.reps || "?"}`
          )
          .join("\n")
      : "_exercicios nao gerados_";

  // Refeicoes — agora mostra TITULO + ALIMENTOS detalhados (3-6 itens por refeicao)
  const ref = b?.refeicoes || {};
  const refeicoes = [
    formatMeal(ref.cafe_da_manha, "🍳", "Café"),
    formatMeal(ref.almoco, "🍽️", "Almoço"),
    // Lanche so aparece se Gemini mandou (comida de 3 refeicoes nao tem lanche)
    ref.lanche ? formatMeal(ref.lanche, "🥪", "Lanche") : null,
    formatMeal(ref.jantar, "🍽️", "Jantar"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const agua = b?.meta_agua_litros ?? 2;
  const dica = b?.dica_do_dia || "Bebe agua e faz o basico que da certo.";

  return `Bom dia, ${firstName}! ☀️

${mensagem}

🏋️ *Treino de hoje: ${treino?.tipo || "—"}* (${treino?.duracao_estimada || "—"})
${treinoLines}
${treino?.observacoes ? `\n_${treino.observacoes}_` : ""}

${refeicoes}

💧 Meta: ${agua}L de água até o fim do dia
💡 ${dica}

Bom proveito e bom treino! 💚`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const stats = {
    total_active: 0,
    processed: 0,
    generated: 0,
    sent_text: 0,
    sent_template: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // =================================================================
    // 1. BUSCA RECIPIENTS ELEGIVEIS (B+7.1)
    // (getEligibleBriefingRecipients une pagos + trial users em trial)
    // =================================================================
    const recipients = await getEligibleBriefingRecipients();
    stats.total_active = recipients.length;
    console.log(
      `[briefing-orchestrator] ${stats.total_active} recipient(s) elegivel(is)`
    );

    if (recipients.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Nenhum recipient elegivel. Nada a fazer.",
        ...stats,
        duration_ms: Date.now() - startedAt,
      });
    }

    // Aplica limite pra evitar timeout
    const queue = recipients.slice(0, MAX_USERS_PER_RUN);
    if (queue.length < recipients.length) {
      console.log(
        `[briefing-orchestrator] processando ${queue.length} de ${recipients.length} (restante na proxima execucao)`
      );
    }

    // =================================================================
    // 2. PRA CADA SUBSCRIBER: gera + envia briefing
    // Serial pra nao estourar rate limit do Gemini
    // =================================================================
    for (const recipient of queue) {
      stats.processed++;
      // IMPORTANTE: o bot whatsapp-web.js identifica o contato pelo LID,
      // NAO pelo numero de telefone. O `phone` do user pode estar sujo
      // (user-store.ts salva digitos do LID quando nao acha telefone real).
      // Sempre usar `recipient.lid` pro envio.
      const phone = recipient.lid;
      const recipientName = recipient.name;

      try {
        if (!phone) {
          stats.skipped++;
          stats.errors.push(`no_lid: ${recipient.user_id}`);
          continue;
        }

        // 2a. Busca user completo na tabela `users` (ja temos user_id do recipient)
        const { data: user, error: userErr } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", recipient.user_id)
          .maybeSingle();

        if (userErr || !user) {
          stats.skipped++;
          stats.errors.push(
            `user_not_found: ${phone} (id=${recipient.user_id}, ${userErr?.message || "no row"})`
          );
          continue;
        }

        // 2b. Pula se ainda nao terminou onboarding
        if (user.onboarding_completed !== true) {
          stats.skipped++;
          console.log(
            `[briefing-orchestrator] pulando ${phone}: onboarding incompleto`
          );
          continue;
        }

        // 2c. Busca profile fisico do user na tabela `profiles`
        // (dados de peso, altura, equipamento, etc vem daqui)
        const { data: profileRow, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileErr) {
          stats.skipped++;
          stats.errors.push(
            `profile_query_failed: ${phone} (${profileErr.message})`
          );
          continue;
        }

        if (!profileRow) {
          stats.skipped++;
          stats.errors.push(
            `profile_not_found: ${phone} (user_id=${user.id})`
          );
          continue;
        }

        // 2d. Constroi UserProfile a partir de users + profiles
        const profile = buildProfile(user, profileRow);
        if (!profile.weight_kg || profile.weight_kg <= 0) {
          stats.skipped++;
          stats.errors.push(
            `no_weight: ${phone} (profile.current_weight_kg ausente ou zero)`
          );
          continue;
        }

        // 2d. Gera briefing via Gemini
        const result = await generateBriefing(profile);
        if (!result.ok) {
          stats.failed++;
          stats.errors.push(`gemini_failed (${phone}): ${result.error}`);
          continue;
        }
        stats.generated++;
        console.log(
          `[briefing-orchestrator] briefing gerado pra ${phone} (${recipient.source}) em ${result.duration_ms}ms`
        );

        // 2e. Formata texto + envia
        const briefingText = formatBriefingAsText(
          result.briefing,
          recipientName
        );

        // Tenta texto livre primeiro (funciona se user falou nas ultimas 24h)
        // IMPORTANTE: sendTextMessage NAO joga excecao — retorna { ok, error }.
        // O try/catch anterior era armadilha: nunca pegava nada e marcava
        // sent_text++ mesmo em falha. Agora checa result.ok.
        const firstName = (recipientName || "amigo(a)").split(" ")[0];
        const textResult = await sendTextMessage(phone, briefingText);

        if (textResult.ok) {
          stats.sent_text++;
          console.log(
            `[briefing-orchestrator] Zap OK (texto livre) pra ${phone} (msg ${textResult.messageId})`
          );
        } else {
          console.warn(
            `[briefing-orchestrator] texto livre falhou pra ${phone}: ${textResult.error} (HTTP ${textResult.statusCode || "?"})`
          );

          // Cai pro template (funciona a qualquer momento)
          const tplResult = await sendTemplateMessage(
            phone,
            "daily_briefing",
            "pt_BR",
            [
              firstName,
              result.briefing?.data || new Date().toLocaleDateString("pt-BR"),
              result.briefing?.treino?.tipo || "personalizado",
            ]
          );

          if (tplResult.ok) {
            stats.sent_template++;
            console.log(
              `[briefing-orchestrator] Zap OK (template fallback) pra ${phone} (msg ${tplResult.messageId})`
            );
          } else {
            // FALHA REAL — nem texto livre nem template funcionou
            stats.failed++;
            stats.errors.push(
              `send_failed (${phone}): texto=${textResult.error} | template=${tplResult.error}`
            );
            console.error(
              `[briefing-orchestrator] AMBOS envios falharam pra ${phone}: ` +
                `texto="${textResult.error}" | ` +
                `template="${tplResult.error}"`
            );
          }
        }

        // 2f. Pausa entre envios pra nao martelar o Meta
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        stats.failed++;
        stats.errors.push(`user_error (${phone}): ${String(err)}`);
        console.error(
          `[briefing-orchestrator] erro ao processar ${phone}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error("[briefing-orchestrator] ERRO GERAL:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
        ...stats,
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }

  const duration = Date.now() - startedAt;
  console.log(
    `[briefing-orchestrator] finished em ${duration}ms: ${JSON.stringify(stats)}`
  );

  return NextResponse.json({
    ok: true,
    ...stats,
    duration_ms: duration,
  });
}

// =================================================================
// POST — ENVIO DIRETO (helper pra testes manuais)
// =================================================================
// Body esperado:
//   {
//     phone: "5511999999999",
//     nome: "Maria",
//     data: "12/07",
//     tipo_treino: "Pernas",
//     briefing_texto: "Texto completo do briefing..."   // ate ~4000 chars
//   }
//
// Em prod, o orquestrador (GET) ja faz o trabalho de gerar + enviar.
// Esse POST fica pra casos de reenvio manual (suporte, debug, etc).
// =================================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, nome, data, tipo_treino, briefing_texto } = body;

    if (!phone || !briefing_texto) {
      return NextResponse.json(
        { error: "phone e briefing_texto sao obrigatorios" },
        { status: 400 }
      );
    }

    try {
      // 1. Tenta mandar texto livre (so vai se o user falou nas ultimas 24h)
      await sendTextMessage(phone, briefing_texto);
      console.log(`[Daily Briefing] Texto livre enviado pra ${phone}`);
    } catch (error) {
      // 2. Se falhar (fora da janela 24h), cai pro template "daily_briefing"
      console.log(
        `[Daily Briefing] Fora da janela 24h. Caindo pro template. ${error}`
      );
      await sendTemplateMessage(
        phone,
        "daily_briefing",
        "pt_BR",
        [nome || "", data || "", tipo_treino || ""]
      );
      console.log(`[Daily Briefing] Template enviado pra ${phone}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Daily Briefing] Erro fatal:", error);
    return NextResponse.json(
      { error: "Falha no disparo" },
      { status: 500 }
    );
  }
}
