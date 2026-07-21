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
import { generateChatReply } from "@/lib/ai";
import { getHistory, addMessage } from "@/lib/conversation-store";
import { getOrCreateUserByLid } from "@/lib/user-store";
import { getUserProfile, addFeedbackItems } from "@/lib/profile-store";

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

  // 5) Busca profile completo (B+4)
  //    Se user nao tem profile ainda (acabou de chegar), retorna null
  //    e a IA cai no modo "novo usuario / onboarding"
  let profile = null;
  try {
    profile = await getUserProfile(user.id);
  } catch (e) {
    log("AVISO getUserProfile falhou (seguindo sem profile):", e);
  }
  log("profile:", profile ? `${profile.name} (${profile.goal}, onboarding=${profile.onboarding_completed})` : "SEM PROFILE (novo user)");

  // 6) Busca historico (msgs ANTES da atual)
  const historyBefore = await getHistory(user.id);
  log("historico antes:", historyBefore.length, "msgs");

  // 7) Gera resposta com Gemini (com contexto de profile + historico)
  log("gerando resposta com Gemini...");
  const aiResult = await generateChatReply({
    profile,
    history: historyBefore,
    userMessage: message,
  });

  if (!aiResult.ok || !aiResult.reply) {
    log("ERRO Gemini:", aiResult.error);
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao gerar resposta com IA",
        details: aiResult.error,
        duration_ms: aiResult.duration_ms,
      },
      { status: 500 }
    );
  }

  const responseText = aiResult.reply;
  log("resposta da IA gerada em", aiResult.duration_ms, "ms");
  log("preview:", responseText.slice(0, 100));

  // 8) Salva feedback_items detectados (B+5)
  //    A IA pode ter identificado lesoes, preferencias, mudancas de rotina
  //    que devem ser lembradas nos briefings futuros.
  const newFeedbackItems = aiResult.feedback_items || [];
  if (newFeedbackItems.length > 0) {
    try {
      const added = await addFeedbackItems(user.id, newFeedbackItems);
      log(`feedback_items: ${newFeedbackItems.length} detectados, ${added} novos salvos no profile`);
    } catch (e) {
      log("AVISO addFeedbackItems falhou (continuando):", e);
    }
  }

  // 9) Salva no historico: msg do user + resposta da IA
  await addMessage(user.id, "user", message);
  await addMessage(user.id, "assistant", responseText);

  const historyAfter = await getHistory(user.id);
  log("historico depois:", historyAfter.length, "msgs");

  // 10) Envia resposta de volta via bot
  log("enviando resposta de volta para", phone, "...");
  const sendResult = await sendTextMessage(phone, responseText);

  if (sendResult.ok) {
    log("resposta enviada com sucesso! to:", (sendResult as any).to || (sendResult as any).phone);
  } else {
    log("ERRO ao enviar resposta:", sendResult.error);
  }

  // 11) Retorna pro bot
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      onboarding_completed: user.onboarding_completed,
    },
    profile_loaded: profile !== null,
    ai: {
      reply: responseText,
      feedback_detected: aiResult.feedback_detected || false,
      feedback_items: aiResult.feedback_items || [],
      duration_ms: aiResult.duration_ms,
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
    description: "Recebe msg do bot, busca/cria user, processa com Gemini (com memoria persistente), responde",
    auth: BOT_API_KEY ? "Bearer token obrigatorio" : "SEM AUTH (configure WHATSAPP_BOT_API_KEY!)",
  });
}
