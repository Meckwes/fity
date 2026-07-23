// =================================================================
// FITY — Webhook v2: recebe mensagens do bot whatsapp-web.js
// =================================================================
// Fluxo:
//   1. bot (VM) recebe msg do usuario no WhatsApp
//   2. bot faz POST pra essa rota com { phone (LID), message, name, ... }
//   3. Fity valida API key
//   4. Fity busca/cria user pelo LID (lib/user-store.ts)
//   5. Fity busca historico de conversas do user (lib/conversation-store.ts)
//   6. Fity processa com Gemini passando o historico
//   7. Fity salva a msg do user E a resposta no historico
//   8. Fity RESPONDE de volta via bot
// =================================================================

import { NextResponse } from "next/server";
import { sendTextMessage } from "@/lib/whatsapp";
import { generateChatReply, generateOnboardingStep } from "@/lib/ai";
import { getHistory, addMessage } from "@/lib/conversation-store";
import { getOrCreateUserByLid } from "@/lib/user-store";
import { getUserProfile, addFeedbackItems } from "@/lib/profile-store";
import { getOnboardingState, saveOnboardingStep } from "@/lib/onboarding-store";

const BOT_API_KEY = process.env.WHATSAPP_BOT_API_KEY || "";

function log(...args: any[]) {
  console.log("[whatsapp-v2]", ...args);
}

export async function POST(req: Request) {
  // 1) Auth check
  if (BOT_API_KEY) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${BOT_API_KEY}`) {
      log("AUTH FALHOU - chave invalida/ausente");
      return NextResponse.json(
        { ok: false, error: "API key invalida ou ausente" },
        { status: 401 }
      );
    }
  }

  // 2) Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body invalido (nao e JSON)" },
      { status: 400 }
    );
  }

  const { phone, message, name } = body || {};

  if (!phone || !message) {
    return NextResponse.json(
      { ok: false, error: "phone e message sao obrigatorios" },
      { status: 400 }
    );
  }

  // 3) Log basico
  log("recebido de", { name: name || "(sem nome)", phone });
  log("  mensagem:", message.slice(0, 200));

  // 4) Busca OU cria o user pelo LID
  let user;
  try {
    user = await getOrCreateUserByLid(phone, name);
  } catch (e) {
    log("ERRO getOrCreateUserByLid:", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao buscar/criar usuario" },
      { status: 500 }
    );
  }
  log("user:", user.id, user.name, "onboarding_step:", user.onboarding_step);

  // 5) DECISAO DE FLUXO: onboarding ou chat livre?
  //    - onboarding (user.onboarding_completed === false):
  //        state machine que coleta goal, weight, height, equipment, restrictions, workout_time
  //        a IA faz UMA pergunta por vez, extrai dados estruturados, salva no profile
  //        quando completa, marca onboarding_completed=true
  //        (assim o briefing diario de 7h funciona)
  //    - chat livre (user.onboarding_completed === true):
  //        IA conversa normal com profile + history + feedback loop
  // =================================================================

  // Busca historico (msgs ANTES da atual) - usado em AMBOS os fluxos
  const historyBefore = await getHistory(user.id);
  log("historico antes:", historyBefore.length, "msgs");

  let responseText = "";
  let responseMode: "onboarding" | "chat" = "chat";
  let onboardingResult: { newStep: string; completed: boolean; savedFields: string[] } | null = null;
  let feedbackDetected = false;
  let feedbackItemsSaved: any[] = [];
  let aiDurationMs = 0;

  if (!user.onboarding_completed) {
    // ============================================================
    // FLUXO ONBOARDING (state machine)
    // ============================================================
    responseMode = "onboarding";
    log("MODO ONBOARDING: user precisa completar perfil");

    // 5.1) Busca estado atual do onboarding (step + dados ja coletados)
    const state = await getOnboardingState(user.id);
    log("  state:", { step: state.step, completed: state.completed, name: state.name });
    log("  ja coletado:", Object.keys(state.collectedData).join(", ") || "(nada)");

    // 5.2) Chama IA no modo onboarding
    log("  gerando resposta com Gemini (onboarding)...");
    const startedAt = Date.now();
    const result = await generateOnboardingStep({
      currentStep: state.step,
      collectedData: state.collectedData,
      history: historyBefore,
      userMessage: message,
    });
    aiDurationMs = Date.now() - startedAt;

    if (!result.ok || !result.message) {
      log("  ERRO Gemini onboarding:", result.error);
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao gerar resposta de onboarding com IA",
          details: result.error,
          duration_ms: aiDurationMs,
        },
        { status: 500 }
      );
    }

    responseText = result.message;
    log("  resposta onboarding em", aiDurationMs, "ms");
    log("  preview:", responseText.slice(0, 100));
    log("  extracted:", result.extracted);
    log("  is_complete:", result.is_complete);

    // 5.3) Salva step (so se user deu resposta valida)
    if (result.user_provided_valid_answer) {
      try {
        const saved = await saveOnboardingStep(
          user.id,
          state.step,
          result.extracted || {},
          result.is_complete || false
        );
        onboardingResult = {
          newStep: saved.newStep,
          completed: saved.completed,
          savedFields: Object.keys(result.extracted || {}),
        };
        log(
          `  onboarding avancado: ${state.step} -> ${saved.newStep} | completed=${saved.completed}`
        );

        // 5.4) UX: se acabou de fechar o onboarding, monta resumo
        // do que foi coletado e promete explicitamente o briefing de amanha
        if (saved.completed) {
          const firstName = (user.name || "amigo(a)").split(" ")[0];

          // Busca o profile completo pra montar o resumo
          let profileResumo = "";
          try {
            const { getUserProfile } = await import("@/lib/profile-store");
            const p = await getUserProfile(user.id);
            if (p) {
              const goalLabel: Record<string, string> = {
                emagrecer: "emagrecer",
                "ganhar-massa": "ganhar massa",
                saude: "saúde",
                performance: "performance",
                recomecar: "recomeçar do zero",
              };
              const timeLabel: Record<string, string> = {
                manha: "de manhã",
                almoco: "no almoço",
                tarde: "à tarde",
                noite: "à noite",
              };
              const equipLabel = (p.equipment && p.equipment.length > 0)
                ? p.equipment.join(" + ")
                : "peso corporal";
              const restrLabel = (p.dietary_restrictions && p.dietary_restrictions.length > 0)
                ? p.dietary_restrictions.join(", ")
                : "sem restrições";
              const mealsLabel = p.meals_per_day
                ? `${p.meals_per_day} refeições/dia`
                : "4 refeições/dia";
              const daysLabel = p.workout_days_per_week
                ? `${p.workout_days_per_week}x semana`
                : "3x semana";
              const timePrefLabel = p.workout_time ? timeLabel[p.workout_time] : "à tarde";

              // Preferencias alimentares (gosta / nao gosta)
              const fp = p.food_preferences;
              const likesLabel = fp?.likes && fp.likes.length > 0 ? fp.likes.join(", ") : null;
              const dislikesLabel = fp?.dislikes && fp.dislikes.length > 0 ? fp.dislikes.join(", ") : null;

              const lines: string[] = [];
              lines.push(`🎯 *Objetivo:* ${goalLabel[p.goal] || p.goal}`);
              if (p.weight_kg) lines.push(`⚖️ *Peso:* ${p.weight_kg}kg`);
              lines.push(`🏋️ *Treino:* ${daysLabel} ${timePrefLabel}, ${equipLabel}`);
              lines.push(`🍽️ *Alimentação:* ${mealsLabel}, ${restrLabel}`);
              if (likesLabel) lines.push(`👍 *Gosta de:* ${likesLabel}`);
              if (dislikesLabel) lines.push(`👎 *Não come:* ${dislikesLabel}`);

              profileResumo = `\n\n📋 *Resumo do que anotei:*\n${lines.join("\n")}`;
            }
          } catch (e) {
            log("  AVISO ao buscar profile pro resumo:", e);
          }

          responseText = `${responseText}${profileResumo}\n\n📅 ${firstName}, amanhã às 7h da manhã eu te mando teu primeiro briefing completo (treino + alimentos detalhados do dia). Fica esperto! 💪`;
          log("  onboarding COMPLETO — resumo + briefing 7h prometido");
        }
      } catch (e) {
        log("  ERRO saveOnboardingStep:", e);
      }
    } else {
      log("  user nao deu resposta valida - step NAO avanca");
    }
  } else {
    // ============================================================
    // FLUXO CHAT LIVRE (profile + history + feedback loop)
    // ============================================================
    responseMode = "chat";
    log("MODO CHAT: user tem onboarding completo");

    // 5.1) Busca profile completo
    let profile = null;
    try {
      profile = await getUserProfile(user.id);
    } catch (e) {
      log("  AVISO getUserProfile falhou (seguindo sem profile):", e);
    }
    log(
      "  profile:",
      profile
        ? `${profile.name} (${profile.goal}, onboarding=${profile.onboarding_completed})`
        : "SEM PROFILE (raro mas pode acontecer)"
    );

    // 5.2) Gera resposta com Gemini (chat)
    log("  gerando resposta com Gemini (chat)...");
    const startedAt = Date.now();
    const aiResult = await generateChatReply({
      profile,
      history: historyBefore,
      userMessage: message,
    });
    aiDurationMs = Date.now() - startedAt;

    if (!aiResult.ok || !aiResult.reply) {
      log("  ERRO Gemini chat:", aiResult.error);
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao gerar resposta com IA",
          details: aiResult.error,
          duration_ms: aiDurationMs,
        },
        { status: 500 }
      );
    }

    responseText = aiResult.reply;
    log("  resposta chat em", aiDurationMs, "ms");
    log("  preview:", responseText.slice(0, 100));

    // 5.3) Salva feedback_items detectados (B+5)
    const newFeedbackItems = aiResult.feedback_items || [];
    if (newFeedbackItems.length > 0) {
      try {
        const added = await addFeedbackItems(user.id, newFeedbackItems);
        feedbackDetected = true;
        feedbackItemsSaved = newFeedbackItems;
        log(
          `  feedback_items: ${newFeedbackItems.length} detectados, ${added} novos salvos no profile`
        );
      } catch (e) {
        log("  AVISO addFeedbackItems falhou (continuando):", e);
      }
    }
  }

  // 6) Salva no historico: msg do user + resposta da IA (AMBOS os fluxos)
  await addMessage(user.id, "user", message);
  await addMessage(user.id, "assistant", responseText);

  const historyAfter = await getHistory(user.id);
  log("historico depois:", historyAfter.length, "msgs");

  // 7) Envia resposta de volta via bot
  log("enviando resposta de volta para", phone, "...");
  const sendResult = await sendTextMessage(phone, responseText);

  if (sendResult.ok) {
    log("resposta enviada com sucesso!");
  } else {
    log("ERRO ao enviar resposta:", sendResult.error);
  }

  // 8) Retorna pro bot (com info de qual modo foi usado)
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      onboarding_completed: user.onboarding_completed,
    },
    mode: responseMode,
    ai: {
      reply: responseText,
      duration_ms: aiDurationMs,
      ...(responseMode === "onboarding" && onboardingResult
        ? {
            onboarding: {
              new_step: onboardingResult.newStep,
              completed: onboardingResult.completed,
              saved_fields: onboardingResult.savedFields,
            },
          }
        : {}),
      ...(responseMode === "chat"
        ? {
            feedback_detected: feedbackDetected,
            feedback_items: feedbackItemsSaved,
          }
        : {}),
    },
    history: {
      before: historyBefore.length,
      after: historyAfter.length,
    },
    reply: {
      sent: sendResult.ok,
      error: !sendResult.ok ? sendResult.error : undefined,
    },
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/whatsapp-v2",
    method: "POST",
    description:
      "Recebe msg do bot. Detecta automaticamente: ONBOARDING (state machine, salva profile) ou CHAT (memoria + feedback loop). Responde via bot.",
    auth: BOT_API_KEY ? "Bearer token obrigatorio" : "SEM AUTH (configure WHATSAPP_BOT_API_KEY!)",
  });
}
