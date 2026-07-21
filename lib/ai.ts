// =================================================================
// FITY — Cerebro da IA (Google Gemini)
// Gera briefings diarios + responde conversas em tempo real
// =================================================================
// Por que Gemini 1.5 Flash?
// - Gratis (ate 1500 req/dia no tier free)
// - Rapido (resposta em ~3-5s)
// - Suporta responseMimeType: application/json (output estruturado)
// - Multimodal (podemos adicionar foto de marmita no futuro)
//
// Como funciona o fluxo:
// 1. Webhook Zap -> carrega profile do user do Supabase
// 2. Chama generateBriefing(profile) -> Gemini retorna JSON
// 3. Backend formata o JSON como mensagem do WhatsApp
// 4. sendMessage() dispara pro Zap
// =================================================================

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { FITY_SYSTEM_INSTRUCTION } from "./ai-prompts";

// =================================================================
// TIPOS
// =================================================================

export type UserGoal =
  | "emagrecer"
  | "ganhar-massa"
  | "saude"
  | "performance"
  | "recomecar";

export type UserSex = "M" | "F" | "outro";

export type ActivityLevel =
  | "sedentario"
  | "leve"
  | "moderado"
  | "intenso"
  | "muito_intenso";

export type WorkoutTime = "manha" | "almoco" | "tarde" | "noite";

export type UserProfile = {
  name: string;
  goal: UserGoal;
  weight_kg: number;
  height_cm?: number;
  age?: number;
  sex?: UserSex;
  activity_level?: ActivityLevel;
  equipment?: string[];
  dietary_restrictions?: string[];
  meals_per_day?: number;
  workout_days_per_week?: number;
  workout_time?: WorkoutTime;
  // Status do onboarding (controla se a IA faz perguntas de coleta de dados
  // ou assume que o perfil ja esta pronto pra conversas de chat)
  onboarding_completed?: boolean;
  // Anotacoes perpetuas aprendidas com o tempo (Step 8)
  adaptation_context?: FeedbackItem[];
};

// =================================================================
// FEEDBACK LOOP — anotacoes perpetuas sobre o usuario
// =================================================================

export type FeedbackType =
  | "injury"      // lesao, dor cronica, limitacao fisica
  | "preference"  // gosto / aversao alimentar ou de exercicio
  | "schedule"    // mudanca permanente de rotina/horario
  | "general";    // outras infos duradouras

export type FeedbackItem = {
  id?: string;
  type: FeedbackType;
  category: string;   // ex: "joelho", "batata_doce", "horario_manha"
  note: string;        // texto completo do feedback
  permanent: boolean;  // se true, sempre considerar nos briefings futuros
  created_at?: string;
};

export type BriefingExercise = {
  nome: string;
  series: number;
  reps: string;
  descanso: string;
  observacao?: string;
};

export type BriefingMeal = {
  titulo: string;
  alimentos: string[];
  kcal_estimado: number;
};

export type DailyBriefing = {
  data: string;
  mensagem_motivacional: string;
  treino: {
    tipo: string;
    duracao_estimada: string;
    exercicios: BriefingExercise[];
    observacoes: string;
  };
  refeicoes: {
    cafe_da_manha: BriefingMeal;
    almoco: BriefingMeal;
    lanche?: BriefingMeal;
    jantar: BriefingMeal;
  };
  meta_agua_litros: number;
  dica_do_dia: string;
};

export type GenerateBriefingResult =
  | { ok: true; briefing: DailyBriefing; raw: string; duration_ms: number }
  | { ok: false; error: string; raw?: string; duration_ms: number };

// =================================================================
// CLIENTE GEMINI (singleton)
// =================================================================

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  if (genAIInstance) return genAIInstance;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
}

// =================================================================
// FUNCAO PRINCIPAL
// =================================================================

/**
 * Gera o briefing diario personalizado para um usuario.
 *
 * @param profile - dados do usuario (objetivo, peso, equipamento, etc)
 * @returns { ok: true, briefing } em caso de sucesso
 *          { ok: false, error } em caso de erro
 *
 * @example
 *   const r = await generateBriefing({
 *     name: "Jessica",
 *     goal: "emagrecer",
 *     weight_kg: 80,
 *     height_cm: 165,
 *     ...
 *   });
 *   if (r.ok) {
 *     console.log(r.briefing.refeicoes.almoco.titulo);
 *   }
 */
export async function generateBriefing(
  profile: UserProfile
): Promise<GenerateBriefingResult> {
  const startedAt = Date.now();

  // 1. Valida API key
  const genAI = getGenAI();
  if (!genAI) {
    return {
      ok: false,
      error: "GEMINI_API_KEY nao esta no .env.local",
      duration_ms: Date.now() - startedAt,
    };
  }

  // 2. Valida campos minimos
  if (!profile.name || !profile.goal || !profile.weight_kg) {
    return {
      ok: false,
      error: "Profile incompleto: name, goal e weight_kg sao obrigatorios",
      duration_ms: Date.now() - startedAt,
    };
  }

  // 3. Pega modelo com system instruction
  //    IMPORTANTE: responseSchema FORCA o Gemini a seguir a estrutura exata
  //    do DailyBriefing. Sem isso, o Gemini improvisa e o TypeScript quebra.
  //    O cast `as any` aqui e necessario porque a tipagem da SDK e muito
  //    restritiva (recursiva) — o schema em si e valido.
  const briefingSchema = {
    type: SchemaType.OBJECT,
    properties: {
      data: { type: SchemaType.STRING },
      mensagem_motivacional: { type: SchemaType.STRING },
      treino: {
        type: SchemaType.OBJECT,
        properties: {
          tipo: { type: SchemaType.STRING },
          duracao_estimada: { type: SchemaType.STRING },
          exercicios: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                nome: { type: SchemaType.STRING },
                series: { type: SchemaType.NUMBER },
                reps: { type: SchemaType.STRING },
                descanso: { type: SchemaType.STRING },
                observacao: { type: SchemaType.STRING },
              },
              required: ["nome", "series", "reps", "descanso"],
            },
          },
          observacoes: { type: SchemaType.STRING },
        },
        required: ["tipo", "duracao_estimada", "exercicios", "observacoes"],
      },
      refeicoes: {
        type: SchemaType.OBJECT,
        properties: {
          cafe_da_manha: {
            type: SchemaType.OBJECT,
            properties: {
              titulo: { type: SchemaType.STRING },
              alimentos: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
              kcal_estimado: { type: SchemaType.NUMBER },
            },
            required: ["titulo", "alimentos", "kcal_estimado"],
          },
          almoco: {
            type: SchemaType.OBJECT,
            properties: {
              titulo: { type: SchemaType.STRING },
              alimentos: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
              kcal_estimado: { type: SchemaType.NUMBER },
            },
            required: ["titulo", "alimentos", "kcal_estimado"],
          },
          lanche: {
            type: SchemaType.OBJECT,
            properties: {
              titulo: { type: SchemaType.STRING },
              alimentos: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
              kcal_estimado: { type: SchemaType.NUMBER },
            },
            required: ["titulo", "alimentos", "kcal_estimado"],
          },
          jantar: {
            type: SchemaType.OBJECT,
            properties: {
              titulo: { type: SchemaType.STRING },
              alimentos: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
              kcal_estimado: { type: SchemaType.NUMBER },
            },
            required: ["titulo", "alimentos", "kcal_estimado"],
          },
        },
        required: ["cafe_da_manha", "almoco", "jantar"],
      },
      meta_agua_litros: { type: SchemaType.NUMBER },
      dica_do_dia: { type: SchemaType.STRING },
    },
    required: [
      "data",
      "mensagem_motivacional",
      "treino",
      "refeicoes",
      "meta_agua_litros",
      "dica_do_dia",
    ],
  } as any; // bypass tipagem recursiva da SDK (o schema em si e valido)

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: FITY_SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: briefingSchema, // FORCA a estrutura exata
      temperature: 0.8, // criatividade media-alta (variar refeicoes todo dia)
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });

  // 4. Data formatada em portugues
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // 5. Monta o prompt do usuario com todos os dados
  const notes = profile.adaptation_context ?? [];
  const notesBlock = notes.length > 0
    ? `\n⚠️ RESTRICOES / PREFERENCIAS APRENDIDAS COM O TEMPO (RESPEITE OBRIGATORIAMENTE):\n${notes.map(n => `- [${n.type}] ${n.note}`).join("\n")}\n`
    : "";

  const userMessage = `
Hoje e ${today}.

Gere o briefing diario PERSONALIZADO para este usuario:

NOME: ${profile.name}
OBJETIVO PRINCIPAL: ${profile.goal}
PESO ATUAL: ${profile.weight_kg} kg${profile.height_cm ? `\nALTURA: ${profile.height_cm} cm` : ""}${profile.age ? `\nIDADE: ${profile.age} anos` : ""}${profile.sex ? `\nSEXO: ${profile.sex}` : ""}
NIVEL DE ATIVIDADE: ${profile.activity_level ?? "moderado"}
EQUIPAMENTO DISPONIVEL: ${profile.equipment?.join(", ") ?? "nenhum especificado"}
RESTRICOES ALIMENTARES: ${profile.dietary_restrictions?.join(", ") ?? "nenhuma"}
REFEICOES POR DIA: ${profile.meals_per_day ?? 4}
DIAS DE TREINO POR SEMANA: ${profile.workout_days_per_week ?? 3}
HORARIO PREFERIDO DE TREINO: ${profile.workout_time ?? "tarde"}
${notesBlock}

LEMBRETE: comida brasileira real (arroz, feijao, frango, ovo, tapioca — NAO sugira salmao nem quinoa importada).

Retorne APENAS o JSON com a estrutura solicitada. Sem texto antes ou depois.
  `.trim();

  try {
    // 6. Chama o Gemini
    const result = await model.generateContent(userMessage);
    const text = result.response.text();
    const duration = Date.now() - startedAt;

    if (!text || text.trim().length === 0) {
      return {
        ok: false,
        error: "Gemini retornou resposta vazia",
        raw: text,
        duration_ms: duration,
      };
    }

    // 7. Parseia o JSON
    let briefing: DailyBriefing;
    try {
      briefing = JSON.parse(text);
    } catch (parseErr) {
      return {
        ok: false,
        error: `Gemini retornou resposta que nao e JSON valido: ${parseErr instanceof Error ? parseErr.message : "erro desconhecido"}`,
        raw: text.slice(0, 500),
        duration_ms: duration,
      };
    }

    return {
      ok: true,
      briefing,
      raw: text,
      duration_ms: duration,
    };
  } catch (err) {
    const duration = Date.now() - startedAt;
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Erro ao chamar Gemini: ${err.message}`
          : "Erro desconhecido ao chamar Gemini",
      duration_ms: duration,
    };
  }
}

// =================================================================
// CHAT REPLY — Resposta em tempo real (webhook do Zap)
// =================================================================

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateChatReplyParams = {
  profile: UserProfile | null;
  history: ChatMessage[];
  userMessage: string;
};

export type GenerateChatReplyResult = {
  ok: boolean;
  reply?: string;
  feedback_detected?: boolean;
  feedback_items?: FeedbackItem[];
  error?: string;
  raw?: string;
  duration_ms: number;
};

/**
 * Gera uma resposta de chat em tempo real usando o historico de conversa.
 * TAMBEM analisa se a mensagem do usuario contem feedback PERSISTENTE
 * (lesoes, gostos, mudancas de rotina) que deve ser lembrado nos briefings
 * seguintes.
 *
 * Retorna JSON estruturado com:
 *  - reply: texto casual pra mandar no Zap
 *  - feedback_detected: true se encontrou feedback permanente
 *  - feedback_items: lista de anotacoes extraidas
 *
 * @example
 *   const r = await generateChatReply({
 *     profile: { name: "Jessica", goal: "emagrecer", weight_kg: 80 },
 *     history: [...],
 *     userMessage: "tenho dor cronica no joelho",
 *   });
 *   // r.reply: "Poxa, sinto muito. Vou evitar agachamento profundo..."
 *   // r.feedback_items: [{ type: "injury", category: "joelho", note: "Dor cronica", permanent: true }]
 */
export async function generateChatReply(
  params: GenerateChatReplyParams
): Promise<GenerateChatReplyResult> {
  const startedAt = Date.now();

  // 1. Valida API key
  const genAI = getGenAI();
  if (!genAI) {
    return {
      ok: false,
      error: "GEMINI_API_KEY nao esta no .env.local",
      duration_ms: Date.now() - startedAt,
    };
  }

  // 2. Valida userMessage
  if (!params.userMessage || !params.userMessage.trim()) {
    return {
      ok: false,
      error: "userMessage vazio",
      duration_ms: Date.now() - startedAt,
    };
  }

  // 3. Monta system instruction contextualizado com o perfil
  const profileContext = params.profile
    ? `
# CONTEXTO DO USUARIO QUE ESTA CONVERSANDO AGORA

- Nome: ${params.profile.name}
- Objetivo principal: ${params.profile.goal}
- Peso atual: ${params.profile.weight_kg} kg${params.profile.height_cm ? `\n- Altura: ${params.profile.height_cm} cm` : ""}${params.profile.age ? `\n- Idade: ${params.profile.age} anos` : ""}${params.profile.sex ? `\n- Sexo biologico: ${params.profile.sex}` : ""}
- Nivel de atividade: ${params.profile.activity_level ?? "moderado"}
- Equipamento disponivel: ${params.profile.equipment?.join(", ") ?? "nao especificado"}
- Restricoes alimentares: ${params.profile.dietary_restrictions?.join(", ") ?? "nenhuma"}
- Refeicoes por dia: ${params.profile.meals_per_day ?? 4}
- Dias de treino por semana: ${params.profile.workout_days_per_week ?? 3}
- Horario preferido: ${params.profile.workout_time ?? "tarde"}
${params.profile.onboarding_completed === true ? "" : "\n⚠️ ATENCAO: Este usuario ainda NAO completou o onboarding. Sua primeira tarefa e iniciar/continuar as perguntas pra montar o perfil dele. Faca UMA pergunta por vez."}
`
    : `
# NOVO USUARIO QUE ACABOU DE ENTRAR

Este usuario nao tem perfil ainda (ou acabou de chegar).
Comece o onboarding com a PRIMEIRA pergunta: "Qual teu objetivo principal?"
Opcoes: 1) Emagrecer  2) Ganhar massa muscular  3) Saude e qualidade de vida  4) Performance atletica  5) Recomecar do zero
Faca UMA pergunta por vez e espere a resposta antes de avancar.
`;

  // Notas persistentes que ja temos sobre o usuario
  const existingNotes = params.profile?.adaptation_context ?? [];
  const notesContext = existingNotes.length > 0
    ? `\n# ANOTACOES QUE JA SABEMOS SOBRE ESTE USUARIO (considere sempre):\n${existingNotes.map(n => `- [${n.type}/${n.category}] ${n.note}`).join("\n")}\n`
    : "";

  const chatRules = `
# REGRAS ESPECIFICAS DE CHAT EM TEMPO REAL

- Respostas CURTAS: 1-3 paragrafos no maximo (WhatsApp nao e email)
- Use quebras de linha para legibilidade no celular
- Tom conversacional, nao robotico
- Emojis com moderacao (1-3 por mensagem)
- SEMPRE lembre do que foi dito antes (nao repita perguntas ja respondidas)
- Se o usuario fizer pergunta fora do escopo fitness/saude, redirecione gentilmente
- Se precisar de mais informacao, faca UMA pergunta por vez (nao despeje questionario)
- Mensagens curtas e diretas, sem enrolacao

# ANALISE DE FEEDBACK (sua super-forca!)

Voce tem 2 missoes em CADA mensagem do usuario:
1. Responder naturalmente (campo "reply")
2. Detectar se a mensagem contem FEEDBACK PERSISTENTE que deve ser lembrado nos briefings seguintes (campo "feedback_items")

## QUANDO EXTRAIR FEEDBACK (SOMENTE QUANDO FOR PERSISTENTE)

EXTRAIA quando o usuario informar algo que vai se repetir no futuro:
- "tenho dor cronica no joelho" -> INJURY (permanente)
- "nao gosto de batata doce" -> PREFERENCE (permanente)
- "agora so consigo treinar de manha" -> SCHEDULE (permanente)
- "comecei a fazer yoga toda semana" -> GENERAL (permanente)

NAO EXTRAIA quando for temporario:
- "hoje to cansado" (temporario)
- "esse treino foi pesado" (opniao do dia)
- "gostei" (elogio)
- "como funciona o app?" (duvida)

## TIPOS DE FEEDBACK

- "injury": lesao, dor cronica, limitacao fisica. Category: parte do corpo (joelho, lombar, ombro...)
- "preference": gosto/aversao alimentar ou de exercicio. Category: item especifico (batata_doce, esteira, frango...)
- "schedule": mudanca de rotina/dias/horario. Category: aspecto (horario, dias, viagem)
- "general": outras infos duradouras. Category: topico

## FORMATO DE SAIDA (JSON ESTRUTURADO OBRIGATORIO)

Voce DEVE retornar APENAS este JSON (sem markdown, sem texto antes/depois):
{
  "reply": "sua resposta casual aqui (max 3 paragrafos)",
  "feedback_detected": true | false,
  "feedback_items": [
    {
      "type": "injury" | "preference" | "schedule" | "general",
      "category": "categoria_curta",
      "note": "descricao completa do feedback",
      "permanent": true
    }
  ]
}

Se NAO houver feedback persistente, retorne:
{
  "reply": "sua resposta normal aqui",
  "feedback_detected": false,
  "feedback_items": []
}

## EXEMPLOS

User: "oi, bora treinar"
{
  "reply": "Bora! 💪 Como foi o treino de ontem?",
  "feedback_detected": false,
  "feedback_items": []
}

User: "senti dor no joelho ontem fazendo agachamento"
{
  "reply": "Poxa, dor no joelho e chato. Tenta colocar gelo 15min e me conta amanha se melhorou. Por enquanto vou trocar agachamento por cadeira extensora no proximo briefing.",
  "feedback_detected": true,
  "feedback_items": [
    {
      "type": "injury",
      "category": "joelho",
      "note": "Sentiu dor no joelho ao fazer agachamento",
      "permanent": true
    }
  ]
}

User: "nao suporto batata doce kkkk"
{
  "reply": "Kkkk tranquilo, troco por mandioca ou inhame sem problema. Anotei! 😄",
  "feedback_detected": true,
  "feedback_items": [
    {
      "type": "preference",
      "category": "batata_doce",
      "note": "Nao gosta de batata doce",
      "permanent": true
    }
  ]
}

User: "to meio sem tempo essa semana"
{
  "reply": "Entendi! Posso encurtar o treino pra 20min essa semana. Quer?",
  "feedback_detected": false,
  "feedback_items": []
}
`;

  const fullSystemInstruction = FITY_SYSTEM_INSTRUCTION + profileContext + notesContext + chatRules;

  // 4. Pega modelo (JSON mode pra extrair feedback estruturado)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: fullSystemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.85,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 800,
    },
  });

  // 5. Converte history para o formato do Gemini
  //    Nosso "assistant" -> Gemini "model"
  const geminiHistory = params.history
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  try {
    // 6. Inicia chat com historico
    const chat = model.startChat({
      history: geminiHistory,
    });

    // 7. Envia a mensagem nova do usuario
    const result = await chat.sendMessage(params.userMessage);
    const rawText = result.response.text();

    if (!rawText || !rawText.trim()) {
      return {
        ok: false,
        error: "Gemini retornou resposta vazia",
        duration_ms: Date.now() - startedAt,
      };
    }

    // 8. Parseia o JSON
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Tenta limpar markdown que as vezes sobra
      const cleaned = rawText
        .replace(/^```json\n?/i, "")
        .replace(/```$/i, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Gemini nao retornou JSON valido - devolve como texto puro mesmo
        console.warn("[chat] Gemini nao retornou JSON, devolvendo texto puro");
        return {
          ok: true,
          reply: rawText.trim(),
          feedback_detected: false,
          feedback_items: [],
          raw: rawText,
          duration_ms: Date.now() - startedAt,
        };
      }
    }

    // 9. Valida estrutura minima
    if (typeof parsed.reply !== "string") {
      return {
        ok: false,
        error: "JSON do chat sem campo 'reply' (string)",
        raw: rawText.slice(0, 200),
        duration_ms: Date.now() - startedAt,
      };
    }

    // 10. Sanitiza feedback_items (defensivo)
    const feedbackItems: FeedbackItem[] = Array.isArray(parsed.feedback_items)
      ? parsed.feedback_items.filter((item: any) =>
          item &&
          typeof item.type === "string" &&
          typeof item.category === "string" &&
          typeof item.note === "string" &&
          ["injury", "preference", "schedule", "general"].includes(item.type)
        ).map((item: any) => ({
          type: item.type,
          category: String(item.category).slice(0, 50),
          note: String(item.note).slice(0, 500),
          permanent: item.permanent !== false, // default true
          created_at: new Date().toISOString(),
        }))
      : [];

    return {
      ok: true,
      reply: parsed.reply.trim(),
      feedback_detected: parsed.feedback_detected === true || feedbackItems.length > 0,
      feedback_items: feedbackItems,
      raw: rawText,
      duration_ms: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Erro ao chamar Gemini no chat: ${err.message}`
          : "Erro desconhecido no chat",
      duration_ms: Date.now() - startedAt,
    };
  }
}

// =================================================================
// ONBOARDING — Máquina de estados + extração de dados
// =================================================================
// O backend mantém o estado (onboarding_step no Supabase).
// O Gemini recebe contexto do estado atual e gera:
//   - message: pergunta casual pro user (PT-BR)
//   - extracted: dados estruturados extraídos da resposta
//   - is_complete: true só quando terminaram todas as perguntas
// =================================================================

// Etapas do onboarding (em ordem)
// Os valores batem com o CHECK constraint da coluna onboarding_step
export const ONBOARDING_STEPS = [
  "start",
  "goal",
  "weight",
  "height",
  "equipment",
  "restrictions",
  "workout_time",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// Tipos dos dados extraídos em cada etapa
export type OnboardingExtracted = {
  goal?: "emagrecer" | "ganhar-massa" | "saude" | "performance" | "recomecar";
  current_weight_kg?: number;
  height_cm?: number;
  equipment?: string[];
  dietary_restrictions?: string[];
  workout_time?: "manha" | "almoco" | "tarde" | "noite";
};

export type GenerateOnboardingStepParams = {
  currentStep: string; // passo atual (vem do banco)
  collectedData: OnboardingExtracted; // dados já coletados
  history: ChatMessage[];
  userMessage: string;
};

export type GenerateOnboardingStepResult = {
  ok: boolean;
  message?: string;
  extracted?: OnboardingExtracted;
  user_provided_valid_answer?: boolean;
  is_complete?: boolean;
  next_step?: string;
  raw?: string;
  error?: string;
  duration_ms: number;
};

// Helper: descobre o próximo passo
export function getNextOnboardingStep(currentStep: string): OnboardingStep {
  const idx = ONBOARDING_STEPS.indexOf(currentStep as OnboardingStep);
  if (idx === -1 || idx >= ONBOARDING_STEPS.length - 1) return "done";
  return ONBOARDING_STEPS[idx + 1];
}

/**
 * Gera a próxima interação do onboarding:
 * - Pergunta casual pro user (message)
 * - Extrai dados da resposta (extracted)
 * - Informa se o onboarding foi finalizado (is_complete)
 *
 * @example
 *   const r = await generateOnboardingStep({
 *     currentStep: "goal",
 *     collectedData: {},
 *     history: [],
 *     userMessage: "quero emagrecer",
 *   });
 *   // r.message: "Massa! E quantos kg você tá pesando hoje?"
 *   // r.extracted: { goal: "emagrecer" }
 *   // r.is_complete: false
 */
export async function generateOnboardingStep(
  params: GenerateOnboardingStepParams
): Promise<GenerateOnboardingStepResult> {
  const startedAt = Date.now();

  // 1. Valida API key
  const genAI = getGenAI();
  if (!genAI) {
    return {
      ok: false,
      error: "GEMINI_API_KEY nao esta no .env.local",
      duration_ms: Date.now() - startedAt,
    };
  }

  // 2. Define etapa atual (se "start", assume "goal" como primeira real)
  const currentStep: OnboardingStep =
    params.currentStep === "start" || !ONBOARDING_STEPS.includes(params.currentStep as OnboardingStep)
      ? "goal"
      : (params.currentStep as OnboardingStep);

  // 3. Monta o contexto do onboarding
  const collectedJson = JSON.stringify(params.collectedData, null, 2);
  const isFirstMessage = params.history.length === 0;

  // Instrucao especifica por etapa
  const stepInstructions: Record<OnboardingStep, string> = {
    start: "Apresente-se brevemente e faca a PRIMEIRA pergunta (sobre objetivo).",
    goal: "Extraia o OBJETIVO PRINCIPAL do usuario. Valores validos: emagrecer, ganhar-massa, saude, performance, recomecar.",
    weight: "Extraia o PESO ATUAL em kg (numero). Valores validos: 30 a 300.",
    height: "Extraia a ALTURA em cm (numero). Valores validos: 100 a 250.",
    equipment: "Extraia o EQUIPAMENTO (array). Valores possiveis: academia, academia_completa, halter, elastico, peso_corporal, barra, maquinas.",
    restrictions: "Extraia RESTRICOES ALIMENTARES (array). Valores possiveis: vegano, vegetariano, sem_gluten, sem_lactose, sem_ovos, nenhuma.",
    workout_time: "Extraia o HORARIO PREFERIDO. Valores validos: manha, almoco, tarde, noite.",
    done: "Onboarding finalizado. Celebre e diga que o primeiro briefing sera gerado.",
  };

  const systemInstruction = `${FITY_SYSTEM_INSTRUCTION}

# MODO ENTREVISTADOR (ONBOARDING)

Voce esta fazendo o onboarding de um novo usuario do Fity. Sua missao:
coletar informacoes de forma conversacional.

## ETAPA ATUAL: ${currentStep}
${stepInstructions[currentStep]}

## DADOS JA COLETADOS:
\`\`\`json
${collectedJson}
\`\`\`

## REGRAS AVANCADAS DE EXTRACAO (IMPORTANTISSIMO)

### REGRA 1 - CONVERSAO DE UNIDADES

Sempre que o usuario fornecer valores numericos, CONVERTA antes de colocar no JSON:

ALTURA:
- "1,73" / "1.73" / "1,73m" / "1.73 m" / "1 metro e 73" -> 173 (centimetros)
- "173cm" / "173 cm" / "173" -> 173 (centimetros, sem conversao)
- SEMPRE retornar em CENTIMETROS inteiros no JSON (campo height_cm)
- NUNCA devolver metros (1.73) nem valores quebrados no campo errado

PESO:
- "80kg" / "80 kg" / "80" -> 80 (kg)
- "80.5" -> 80.5 (kg)
- Retornar no campo current_weight_kg

### REGRA 2 - DEDUCAO LOGICA DE CAMPOS

Quando a fala do usuario PERMITIR DEDUZIR outros campos alem do atual, faca isso.

SINAIS DE SEDENTARIO (activity_level = "sedentario"):
- "vou comecar a treinar" / "vou voltar a treinar" / "nunca treinei"
- "to parado ha muito tempo" / "faz tempo que nao treino"
- "comecando do zero" / "recomecar"
- Nao menciona academia nem exercicio previo

SINAIS DE LEVE/MODERADO (activity_level = "leve"):
- "caminho as vezes" / "faço yoga" / "alongamento"
- "treino de vez em quando" / "1-2x por semana"

SINAIS DE INTENSO (activity_level = "intenso"):
- "treino 5-6x por semana" / "atleta" / "competicao"

DEDUCAO DE OBJETIVO:
- "voltar a treinar" + emagrecer -> goal: "emagrecer"
- "ganhar massa" / "ficar forte" / "ficar grande" -> goal: "ganhar-massa"
- "ser mais saudavel" / "cuidar da saude" -> goal: "saude"

DEDUCAO DE EQUIPAMENTO:
- "academia" / "tenho academia" / "vou pra academia" -> equipment: ["academia"]
- "em casa" + "peso corporal" / "sem equipamento" -> equipment: ["peso_corporal"]
- "tenho halter em casa" -> equipment: ["halter", "peso_corporal"]

IMPORTANTE: Quando deduzir um campo, INCLUA no JSON extracted E AVISE o usuario na mensagem:
"Como voce falou de academia, ja anotei equipamento = academia, fechou?"

### REGRA 3 - EXTRACAO DE MULTIPLOS DADOS NA MESMA MENSAGEM

Quando o usuario fornecer VARIOS dados em uma unica mensagem, EXTRAIA TODOS de uma vez.

Exemplo: "quero emagrecer, tenho 80kg, 1,73m, treino na academia completa, sem restricao, meio dia"
-> extracted: {
     "goal": "emagrecer",
     "current_weight_kg": 80,
     "height_cm": 173,
     "equipment": ["academia"],
     "dietary_restrictions": ["nenhuma"],
     "workout_time": "almoco"
   }
-> Pule para a pergunta da proxima etapa QUE AINDA NAO FOI RESPONDIDA
-> NUNCA repita uma pergunta cujo campo ja foi extraido nesta mensagem

Exemplo 2: user respondeu so "emagrecer 8kg"
-> extracted: { "goal": "emagrecer" }
-> Prossiga para a proxima pergunta (peso)

Exemplo 3: "quero emagrecer e tenho 1,75m" (sem peso ainda)
-> extracted: { "goal": "emagrecer", "height_cm": 175 }
-> Proxima pergunta: peso

## FORMATO DE SAIDA (OBRIGATORIO - JSON ESTRUTURADO)

Voce DEVE retornar APENAS este JSON, sem texto antes ou depois:
\`\`\`json
{
  "message": "sua pergunta casual em PT-BR aqui (max 3 frases)",
  "extracted": { /* campo extraido desta resposta, OU {} se invalido */ },
  "user_provided_valid_answer": true | false,
  "is_complete": false
}
\`\`\`

## REGRAS DE COMPORTAMENTO

1. SEMPRE faca UMA pergunta por mensagem (a menos que o usuario ja tenha dado varios dados de uma vez - veja REGRA 3 acima)
2. Use tom casual brasileiro (tu/voce, bora, massa, suave)
3. Respostas CURTAS (max 3 frases por message)
4. Use 1-3 emojis por mensagem (sem exagero)
5. Se o usuario mandou "pula" ou "skip" -> extracted={}, user_provided_valid_answer=true
6. Se o usuario mandou algo invalido (gibberish, fora do contexto) ->
   user_provided_valid_answer=false, extracted={}, faca a mesma pergunta de outro jeito
7. Se o usuario ja respondeu a pergunta mas voce nao extraiu direito,
   tente de novo na proxima mensagem com user_provided_valid_answer=true
8. Quando ETAPA ATUAL = "done" -> is_complete=true, faca uma mensagem de celebracao
9. SEMPRE pule para a proxima pergunta cuja informacao ainda nao foi coletada,
   mesmo que a etapa atual seja diferente (REGRA 3)

## EXEMPLOS

Etapa "goal", user disse "quero emagrecer 8kg":
\`\`\`json
{
  "message": "Massa, emagrecer e pra ja! 💪 E quanto tu ta pesando hoje?",
  "extracted": { "goal": "emagrecer" },
  "user_provided_valid_answer": true,
  "is_complete": false
}
\`\`\`

Etapa "weight", user disse "80kg":
\`\`\`json
{
  "message": "Boa! E qual tua altura?",
  "extracted": { "current_weight_kg": 80 },
  "user_provided_valid_answer": true,
  "is_complete": false
}
\`\`\`

Etapa "goal", user mandou "abcdef" (invalido):
\`\`\`json
{
  "message": "Heh, nao entendi direito. Qual teu objetivo principal? Emagrecer, ganhar massa, saude...?",
  "extracted": {},
  "user_provided_valid_answer": false,
  "is_complete": false
}
\`\`\`

Etapa "weight", user disse "1,73" (REGRA 1 - conversao de altura mesmo na etapa errada):
\`\`\`json
{
  "message": "Show, 173cm anotado! Agora me conta, qual teu peso atual?",
  "extracted": { "height_cm": 173 },
  "user_provided_valid_answer": true,
  "is_complete": false
}
\`\`\`

Etapa "goal", user disse "quero emagrecer e vou comecar a treinar agora" (REGRA 2 - deducao):
\`\`\`json
{
  "message": "Massa! Emagrecer e comecar do zero, anotado. 💪 Como voce falou que vai comecar, ja considerei tu como sedentario. Qual teu peso atual?",
  "extracted": { "goal": "emagrecer", "activity_level": "sedentario" },
  "user_provided_valid_answer": true,
  "is_complete": false
}
\`\`\`

Etapa "goal", user disse "quero emagrecer, tenho 80kg, 1,73m, academia completa, sem restricao, meio dia" (REGRA 3 - extracao multipla - pula varias etapas):
\`\`\`json
{
  "message": "Caraca, mandou tudo de uma vez! 😄 Ja anotei: emagrecer, 80kg, 1,73m, academia completa, sem restricao, meio dia. Agora so me confirma: quantos dias por semana tu consegue treinar?",
  "extracted": {
    "goal": "emagrecer",
    "current_weight_kg": 80,
    "height_cm": 173,
    "equipment": ["academia"],
    "dietary_restrictions": ["nenhuma"],
    "workout_time": "almoco"
  },
  "user_provided_valid_answer": true,
  "is_complete": false
}
\`\`\`
`;

  // 4. Pega modelo com JSON mode
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7, // um pouco mais deterministico que chat livre
      maxOutputTokens: 8192,
    },
  });

  // 5. Converte history
  const geminiHistory = params.history
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(params.userMessage);
    const text = result.response.text();

    if (!text || !text.trim()) {
      return {
        ok: false,
        error: "Gemini retornou resposta vazia no onboarding",
        duration_ms: Date.now() - startedAt,
      };
    }

    // 6. Parseia o JSON
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Gemini pode envolver em markdown as vezes - tenta limpar
      const cleaned = text
        .replace(/^```json\n?/i, "")
        .replace(/```$/i, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return {
          ok: false,
          error: "Gemini nao retornou JSON valido no onboarding",
          raw: text.slice(0, 200),
          duration_ms: Date.now() - startedAt,
        };
      }
    }

    // 7. Valida estrutura mínima
    if (typeof parsed.message !== "string") {
      return {
        ok: false,
        error: "JSON do onboarding sem campo 'message' (string)",
        raw: text.slice(0, 200),
        duration_ms: Date.now() - startedAt,
      };
    }

    return {
      ok: true,
      message: parsed.message.trim(),
      extracted: parsed.extracted ?? {},
      user_provided_valid_answer: parsed.user_provided_valid_answer === true,
      is_complete: parsed.is_complete === true,
      duration_ms: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Erro Gemini no onboarding: ${err.message}`
          : "Erro desconhecido no onboarding",
      duration_ms: Date.now() - startedAt,
    };
  }
}