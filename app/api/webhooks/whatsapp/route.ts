// app/api/webhooks/whatsapp/route.ts
import { NextResponse } from "next/server";
// Aqui você importaria a sua função de IA do Fity, exemplo:
// import { processUserMessage } from "@/lib/ai"; 

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "fity-verify-token-2026";

// O GET serve apenas para a Meta verificar se a URL é sua mesma (na hora de cadastrar o webhook)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Token inválido" }, { status: 403 });
}

// O POST recebe as mensagens enviadas pelos clientes
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Valida se é uma mensagem do WhatsApp
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ error: "Não é do WhatsApp" }, { status: 404 });
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // Se tiver mensagem de texto, a gente processa
    if (message?.type === "text") {
      const phone = message.from;
      const text = message.text.body;

      console.log(`[WhatsApp Webhook] Mensagem recebida de ${phone}: ${text}`);

      // Chame a sua IA aqui para responder. Exemplo:
      // await processUserMessage(phone, text);
    }

    // A Meta exige que você retorne 200 OK rápido
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Webhook] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}