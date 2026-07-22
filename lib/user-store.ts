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
  trial_started_at: string | null;
  trial_ended_notified: boolean;
};

const USER_SELECT =
  "id, phone, lid, name, onboarding_completed, onboarding_step, trial_started_at, trial_ended_notified";

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
    .select(USER_SELECT)
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
 *   - Se trial_started_at for null, seta agora (primeira msg do user)
 * - Se nao existe: cria com o LID, nome e trial_started_at = NOW()
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

    // Se ainda nao tem trial_started_at, seta agora (primeira msg)
    if (!existing.trial_started_at) {
      log("setando trial_started_at (primeira msg):", existing.id);
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("users")
        .update({ trial_started_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select(USER_SELECT)
        .single();

      if (!updateErr && updated) {
        return updated as User;
      }
      // Se der erro no update, retorna o existing mesmo (graceful degradation)
    }
    return existing;
  }

  // 2. Nao existe - cria com trial_started_at = NOW()
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

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      lid,
      name: name || "Usuario sem nome",
      phone: phoneFallback,
      active: true,
      onboarding_completed: false,
      onboarding_step: "start",
      trial_started_at: now, // <- NOVO: trial comeca agora
      trial_ended_notified: false,
    })
    .select(USER_SELECT)
    .single();

  if (error) {
    log("ERRO ao criar usuario:", error);
    throw new Error(`Falha ao criar usuario: ${error.message}`);
  }

  log("usuario criado:", data.id, data.name, "trial_started_at:", now);
  return data as User;
}
