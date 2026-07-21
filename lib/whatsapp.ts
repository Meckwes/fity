// =================================================================
// FITY — Cliente WhatsApp via bot whatsapp-web.js (Evolution-style)
// =================================================================
// O bot roda na VM Oracle (147.15.121.128:9090) e usa Baileys
// (mesma tecnologia do Evolution, mas sem precisar de CNPJ Meta).
//
// Como funciona:
// - O bot está conectado ao WhatsApp Business do celular
// - Recebe requests HTTP /send com {phone, message}
// - Manda a mensagem via WhatsApp (como "linked device")
// - Funciona a qualquer momento (sem restrição de 24h)
//
// Endpoints do bot:
//   POST /send       - body: { phone, message } -> { ok: true }
//   GET  /status     - { ready, has_qr, qr? }
//   GET  /qr.png     - retorna o QR atual
//
// Variaveis de ambiente:
//   WHATSAPP_BOT_URL     - URL do bot (default: http://147.15.121.128:9090)
//   WHATSAPP_BOT_API_KEY - opcional, se o bot tiver API key
// =================================================================

const BOT_API_URL = process.env.WHATSAPP_BOT_URL || "http://147.15.121.128:9090";
const BOT_API_KEY = process.env.WHATSAPP_BOT_API_KEY || "";

// =================================================================
// Normaliza telefone pro formato E.164 BR (55 + DDD + numero) sem "+"
// "(11) 98888-7777" -> "5511988887777"
// Se ja tiver sufixo @c.us ou @lid, preserva (whatsapp-web.js aceita JID direto).
// Aceita string OU number (metadata do MP pode vir como Number).
// =================================================================
export function normalizePhone(phone: string | number | null | undefined): string {
  if (phone === null || phone === undefined || phone === "") return "";

  const phoneStr = String(phone);

  // Preserva sufixo @c.us ou @lid (JID do WhatsApp) se existir
  const suffixMatch = phoneStr.match(/(@c\.us|@lid|@g\.us)$/i);
  const suffix = suffixMatch ? suffixMatch[0] : "";

  let cleaned = phoneStr.replace(/\D/g, "");

  if (cleaned.startsWith("55") && cleaned.length >= 12) return cleaned + suffix;
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }
  return cleaned + suffix;
}

// Resultado padronizado
export type SendMessageResult =
  | { ok: true; messageId?: string; phone: string; raw?: any }
  | { ok: false; error: string; statusCode?: number; raw?: any };

// =================================================================
// Templates LOCAIS (substituem os templates do Meta Cloud).
// O bot nao tem sistema de templates do Meta, mas tem estes textos
// pre-definidos aqui que sao interpolados com as variaveis e enviados
// como mensagem normal.
// =================================================================
type Template = {
  text: string;        // usa {{var}} como placeholder
  variables: string[]; // nomes das variaveis (documentacao)
};

const TEMPLATES: Record<string, Template> = {
  welcome_fity: {
    variables: ['customer_name', 'plan_name', 'amount'],
    text:
      'Oi, {{customer_name}}! 👋\n\n' +
      'Bem-vindo(a) ao Fity {{plan_name}}! Recebemos seu pagamento de R$ {{amount}}.\n\n' +
      'Em instantes, nosso bot te chama no WhatsApp pra comecar o onboarding.\n\n' +
      'Amanhã às 7h você recebe o primeiro briefing personalizado. 💚',
  },

  trial_ending: {
    variables: ['customer_name', 'plan_name', 'amount', 'charge_date'],
    text:
      'Oi, {{customer_name}}! 👋\n\n' +
      'Amanhã ({{charge_date}}) é dia de renovar o {{plan_name}} por R$ {{amount}}.\n\n' +
      'Pra manter, é só tocar no link e pagar rapidinho.\n\n' +
      '{{renewal_link}}\n\n' +
      'Tamo junto! 💚',
  },

  fity_renovacao: {
    variables: ['customer_name', 'plan_name', 'amount', 'charge_date', 'renewal_link'],
    text:
      'Oi, {{customer_name}}! 👋\n\n' +
      'Amanhã ({{charge_date}}) é dia de renovar o {{plan_name}} por R$ {{amount}}.\n\n' +
      'Pra manter, é só tocar no link e pagar rapidinho:\n\n' +
      '{{renewal_link}}\n\n' +
      'Tamo junto! 💚',
  },

  fity_renovacao_pausado: {
    variables: ['customer_name', 'plan_name', 'amount', 'renewal_link'],
    text:
      'Oi, {{customer_name}}!\n\n' +
      'Seu {{plan_name}} pausou hoje porque o ciclo de 30 dias acabou.\n' +
      'Mas relaxa, nada foi cobrado e seus dados tão salvos.\n\n' +
      'Quer voltar? Toca aqui e reativa em 1 minuto:\n\n' +
      '{{renewal_link}}\n\n' +
      'Bora voltar? 💚',
  },
};

// Substitui {{var}} por valor na ordem das ocorrencias
function interpolateTemplate(text: string, variables: string[]): string {
  let i = 0;
  return text.replace(/\{\{[^}]+\}\}/g, () => variables[i++] ?? '');
}

// =================================================================
// Helper interno: POST pro bot
// =================================================================
async function callBot(
  body: Record<string, unknown>,
  timeoutMs: number = 10_000
): Promise<{
  ok: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
  raw?: any;
}> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (BOT_API_KEY) {
      headers["Authorization"] = `Bearer ${BOT_API_KEY}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${BOT_API_URL}/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await res.text();
    let data: any = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { _raw_body: responseText.slice(0, 500) };
    }

    console.log(
      `[BOT] POST /send -> ${res.status}` +
        (data.error ? ` error: ${data.error}` : " ok")
    );

    if (res.ok && data.ok !== false) {
      return { ok: true, messageId: "(bot-nao-retorna-id)", raw: data };
    }

    return {
      ok: false,
      error: data.error || `Bot retornou HTTP ${res.status}`,
      statusCode: res.status,
      raw: data,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.error(
      `[BOT] ERRO${isAbort ? ` (timeout ${timeoutMs}ms)` : " de rede"}:`,
      err
    );
    return {
      ok: false,
      error: isAbort
        ? `Bot nao respondeu em ${timeoutMs}ms (timeout)`
        : err instanceof Error
        ? `Erro de rede ao chamar bot: ${err.message}`
        : "Erro desconhecido",
    };
  }
}

// =================================================================
// Envia TEXTO livre. Funciona a qualquer momento (sem restricao 24h)
// porque o bot age como "linked device" do WhatsApp Business.
// =================================================================
export async function sendTextMessage(
  phone: string,
  text: string
): Promise<SendMessageResult> {
  const to = normalizePhone(phone);

  if (!to) {
    return { ok: false, error: "phone invalido" };
  }
  if (!text || text.trim() === "") {
    return { ok: false, error: "text vazio" };
  }

  const r = await callBot({ phone: to, message: text });

  if (!r.ok) {
    return {
      ok: false,
      error: r.error || "Erro desconhecido",
      statusCode: r.statusCode,
      raw: r.raw,
    };
  }
  return {
    ok: true,
    messageId: r.messageId || "(sem ID)",
    phone: to,
    raw: r.raw,
  };
}

// =================================================================
// Envia TEMPLATE pre-definido (interpolado com variaveis).
// Os templates estao definidos em TEMPLATES acima (substitui os do Meta).
//
// Aceita variables como:
//   - array de strings: ["Maria", "Pro", "49,00"]
//   - string unica: "Maria"
//   - undefined / null / []
//
// IMPORTANTE: languageCode nao e mais usado (era so pro Meta).
// =================================================================
export async function sendTemplateMessage(
  phone: string,
  templateName: string,
  languageCode: string = "pt_BR",
  variables?: string[] | string | null
): Promise<SendMessageResult> {
  const to = normalizePhone(phone);

  if (!to) {
    return { ok: false, error: "phone invalido" };
  }
  if (!templateName) {
    return { ok: false, error: "templateName obrigatorio" };
  }

  // Procura o template no registry local
  const template = TEMPLATES[templateName];
  if (!template) {
    console.warn(
      `[whatsapp] template "${templateName}" nao encontrado no registry local, ` +
        `envia como texto puro (variaveis joined)`
    );
    const text = Array.isArray(variables)
      ? variables.join(" ")
      : String(variables || "");
    return sendTextMessage(phone, text);
  }

  // Normaliza variables -> sempre array
  const vars: string[] = Array.isArray(variables)
    ? variables
    : typeof variables === "string"
    ? [variables]
    : [];

  // Interpola o template
  const text = interpolateTemplate(template.text, vars);

  console.log(
    `[whatsapp] template="${templateName}" vars=${vars.length} -> "${text.slice(0, 80)}..."`
  );

  // Envia como texto normal (bot nao tem sistema de templates)
  return sendTextMessage(phone, text);
}
