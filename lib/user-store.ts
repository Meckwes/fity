// =================================================================
// FITY — Store de usuarios (Supabase)
// =================================================================
// Faz o mapeamento LID (WhatsApp) -> user_id (Supabase).
// Se o usuario nao existir, CRIA automaticamente na primeira msg.
//
// Por que existe: o bot manda o LID (ex: "187178986528995@lid"),
// mas a gente precisa do user_id (UUID) pra salvar conversas e
//关联 com perfil/onboarding.
// =================================================================

import { supabaseAdmin } from "./supabase-admin";

export type User = {
  id: string;
  phone: string | null;
  lid: string | null;
  name: string | null;
  onboarding_completed: boolean;
  onboarding_step: string;
};

function log(...args: any[]) {
  console.log("[user-store]", ...args);
}

/**
 * Busca usuario pelo LID do WhatsApp.
 * Retorna null se nao existir.
 */
export async function getUserByLid(lid: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, phone, lid, name, onboarding_completed, onboarding_step")
    .eq("lid", lid)
    .maybeSingle();

  if (error) {
    log("ERRO getUserByLid:", error);
    return null;
  }
  return data;
}

/**
 * Busca OU cria um usuario pelo LID.
 * - Se existe: retorna user record
 * - Se nao existe: cria com o LID e nome, e retorna o user record novo
 *
 * Quando cria, tambem tenta extrair o "phone" do LID (se for digitos)
 * como fallback. Util pra BR (ex: LID termina em 12+ digitos).
 */
export async function getOrCreateUserByLid(
  lid: string,
  name?: string
): Promise<User> {
  // 1. Tenta achar
  const existing = await getUserByLid(lid);
  if (existing) {
    log("usuario encontrado:", existing.id, existing.name);
    return existing;
  }

  // 2. Nao existe - cria
  log("criando novo usuario pra LID:", lid, "nome:", name);

  // Tenta extrair telefone do LID (se for tudo digito, BR format)
  // Ex: "187178986528995@lid" -> phone = "55187178986528995" (nao ideal mas serve)
  const lidDigits = lid.replace(/\D/g, "");
  let phoneFallback: string | null = null;
  if (lidDigits.length >= 10) {
    // Se comecar com 55, usa direto. Se nao, prepende.
    if (lidDigits.startsWith("55")) {
      phoneFallback = "55" + lidDigits.slice(2); // remove o "55" do LID se tiver
    } else {
      phoneFallback = lidDigits;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      lid,
      name: name || "Usuario sem nome",
      phone: phoneFallback,
      active: true,
      onboarding_completed: false,
      onboarding_step: "start",
    })
    .select("id, phone, lid, name, onboarding_completed, onboarding_step")
    .single();

  if (error) {
    log("ERRO ao criar usuario:", error);
    throw new Error(`Falha ao criar usuario: ${error.message}`);
  }

  log("usuario criado:", data.id, data.name);
  return data;
}
