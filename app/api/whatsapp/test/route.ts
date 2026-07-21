import { NextResponse } from "next/server";
import {
  sendTextMessage,
  sendTemplateMessage,
  normalizePhone,
} from "@/lib/whatsapp";

// =================================================================
// FITY — Test endpoint: envia msg de teste via bot whatsapp-web.js
// =================================================================
// O bot roda na VM (147.15.121.128:9090) e usa o WhatsApp Business
// conectado. Esse endpoint é só pra teste - chama sendTextMessage ou
// sendTemplateMessage (definidas em lib/whatsapp.ts).
// =================================================================

const BOT_URL = process.env.WHATSAPP_BOT_URL || "http://147.15.121.128:9090";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body invalido (nao e JSON)" },
      { status: 400 }
    );
  }

  const { phone, method, text, template, variables } = body;

  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "phone obrigatorio" },
      { status: 400 }
    );
  }

  // Verifica se o bot ta configurado
  if (!process.env.WHATSAPP_BOT_URL) {
    return NextResponse.json(
      {
        ok: false,
        error: "WHATSAPP_BOT_URL nao configurado no .env.local",
        hint: "Adicione WHATSAPP_BOT_URL=http://IP_DA_VM:9090 no .env.local",
        config: {
          WHATSAPP_BOT_URL: "FALTA",
        },
      },
      { status: 500 }
    );
  }

  const cleanPhone = normalizePhone(phone);
  console.log(
    `[test-bot] Enviando ${method || "text"} pra ${cleanPhone} (de ${phone}) via ${BOT_URL}`
  );

  let result;
  if (method === "template") {
    if (!template) {
      return NextResponse.json(
        { ok: false, error: "template obrigatorio quando method=template" },
        { status: 400 }
      );
    }
    result = await sendTemplateMessage(
      cleanPhone,
      template,
      "pt_BR",
      variables || []
    );
  } else {
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "text obrigatorio quando method=text" },
        { status: 400 }
      );
    }
    result = await sendTextMessage(cleanPhone, text);
  }

  // Retorna 200 so quando ok=true. Erro do bot vira 4xx/5xx pra ficar
  // obvio no terminal.
  const status = result.ok ? 200 : result.statusCode || 500;

  return NextResponse.json(
    {
      method: method || "text",
      phone: cleanPhone,
      template: method === "template" ? template : undefined,
      variables: method === "template" ? variables : undefined,
      text: method !== "template" ? text : undefined,
      bot: BOT_URL,
      ...result,
    },
    { status }
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/whatsapp/test",
    metodo: "POST",
    config: {
      WHATSAPP_BOT_URL: process.env.WHATSAPP_BOT_URL || "FALTA",
    },
  });
}
