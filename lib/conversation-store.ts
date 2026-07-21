// =================================================================
// FITY — Store de conversas (Supabase)
// =================================================================
// Substitui a versao em RAM. Agora o historico PERSISTE entre restarts.
//
// Schema: tabela `conversations` (id, user_id, role, content, created_at)
// Key: user_id (UUID do Supabase)
// =================================================================

import { supabaseAdmin } from "./supabase-admin";
import type { ChatMessage } from "./ai";

const MAX_HISTORY = 10;  // 5 trocas (user + assistant). Evita estouro de token.

function log(...args: any[]) {
  console.log("[conversation-store]", ...args);
}

/**
 * Retorna o historico de conversa de um usuario (pode ser vazio).
 * NAO inclui a msg atual (a gente adiciona DEPOIS de gerar a resposta).
 * Retorna em ordem CRONOLOGICA (mais antiga primeiro).
 */
export async function getHistory(userId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);

  if (error) {
    log("ERRO getHistory:", error.message);
    return [];
  }

  // Reverter (query veio DESC, a gente quer ASC pra mandar pro Gemini)
  let history = (data || [])
    .reverse()
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

  // IMPORTANTE: Gemini exige que o historico COMECE com role "user".
  // Se a primeira msg for "assistant" (ex: mensagem de boas-vindas do bot),
  // descarta ate achar a primeira "user".
  // Sem isso, Gemini retorna: "First content should be with role 'user', got model"
  while (history.length > 0 && history[0].role === "assistant") {
    history = history.slice(1);
  }

  return history;
}

/**
 * Adiciona uma mensagem ao historico do usuario.
 */
export async function addMessage(
  userId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("conversations")
    .insert({ user_id: userId, role, content });

  if (error) {
    log("ERRO addMessage:", error.message);
  }
}

/**
 * Limpa o historico de um usuario (util pra testes / "comecar de novo").
 */
export async function clearHistory(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("conversations")
    .delete()
    .eq("user_id", userId);

  if (error) {
    log("ERRO clearHistory:", error.message);
  }
}

/**
 * Stats do store (pra debug).
 */
export async function getStoreStats() {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("user_id");

  if (error) return { error: error.message };

  const uniqueUsers = new Set((data || []).map((r) => r.user_id));
  return {
    total_messages: (data || []).length,
    total_users_with_history: uniqueUsers.size,
    max_history_per_user: MAX_HISTORY,
  };
}
