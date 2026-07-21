// =================================================================
// FITY — Store de perfis de usuario (Supabase)
// =================================================================
// Faz o mapeamento: profiles table (DB) -> UserProfile (lib/ai.ts)
// Tambem gerencia adaptation_context (feedback persistente).
//
// Tabela `profiles`:
//   user_id, goal, current_weight_kg, target_weight_kg, height_cm,
//   age, sex, activity_level, equipment (array), dietary_restrictions (array),
//   meals_per_day, workout_days_per_week, workout_time,
//   daily_calorie_target, daily_protein_target_g, daily_carb_target_g, daily_fat_target_g,
//   updated_at, adaptation_context (jsonb)
// =================================================================

import { supabaseAdmin } from "./supabase-admin";
import type { UserProfile, FeedbackItem } from "./ai";
import { getUserByLid, type User } from "./user-store";

function log(...args: any[]) {
  console.log("[profile-store]", ...args);
}

type ProfileRow = {
  user_id: string;
  goal: string | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  sex: string | null;
  activity_level: string | null;
  equipment: string[] | null;
  dietary_restrictions: string[] | null;
  meals_per_day: number | null;
  workout_days_per_week: number | null;
  workout_time: string | null;
  adaptation_context: FeedbackItem[] | null;
};

/**
 * Busca o profile completo de um user (combina users + profiles).
 * Retorna null se o user nao tem profile ainda.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  // 1) Pega o user (pra ter o name)
  const { data: userData, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, name, onboarding_completed, onboarding_step, lid")
    .eq("id", userId)
    .maybeSingle();

  if (userErr) {
    log("ERRO ao buscar user:", userErr.message);
    return null;
  }
  if (!userData) {
    log("user nao encontrado:", userId);
    return null;
  }

  // 2) Pega o profile
  const { data: profileData, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr) {
    log("ERRO ao buscar profile:", profileErr.message);
    return null;
  }

  if (!profileData) {
    log("user existe mas nao tem profile ainda:", userId);
    return null;
  }

  // 3) Monta UserProfile no formato do lib/ai.ts
  const p = profileData as ProfileRow;
  return {
    name: userData.name || "amigo",
    goal: (p.goal || "saude") as UserProfile["goal"],
    weight_kg: p.current_weight_kg || 70,
    height_cm: p.height_cm ?? undefined,
    age: p.age ?? undefined,
    sex: (p.sex as UserProfile["sex"]) ?? undefined,
    activity_level: (p.activity_level as UserProfile["activity_level"]) ?? undefined,
    equipment: p.equipment ?? undefined,
    dietary_restrictions: p.dietary_restrictions ?? undefined,
    meals_per_day: p.meals_per_day ?? undefined,
    workout_days_per_week: p.workout_days_per_week ?? undefined,
    workout_time: (p.workout_time as UserProfile["workout_time"]) ?? undefined,
    onboarding_completed: userData.onboarding_completed ?? false,
    adaptation_context: p.adaptation_context ?? undefined,
  };
}

/**
 * Adiciona itens de feedback ao adaptation_context do profile.
 * Se o feedback ja existir (mesmo category), atualiza a nota.
 * Se nao, adiciona.
 */
export async function addFeedbackItems(
  userId: string,
  items: FeedbackItem[]
): Promise<number> {
  if (items.length === 0) return 0;

  // 1) Pega o context atual
  const { data: profileData, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("adaptation_context")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    log("ERRO ao buscar adaptation_context:", fetchErr.message);
    return 0;
  }

  const existing: FeedbackItem[] = (profileData?.adaptation_context as FeedbackItem[]) || [];

  // 2) Merge: pra cada item novo, se ja existe (mesmo type+category), atualiza
  const merged: FeedbackItem[] = [...existing];
  let added = 0;

  for (const newItem of items) {
    const idx = merged.findIndex(
      (e) => e.type === newItem.type && e.category === newItem.category
    );
    if (idx >= 0) {
      // Atualiza (sobrescreve)
      merged[idx] = { ...newItem, id: merged[idx].id, created_at: merged[idx].created_at };
    } else {
      // Adiciona novo
      merged.push(newItem);
      added++;
    }
  }

  // 3) Salva
  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({
      adaptation_context: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateErr) {
    log("ERRO ao salvar feedback:", updateErr.message);
    return 0;
  }

  log(`feedbacks processados: ${items.length} (${added} novos, ${items.length - added} atualizados)`);
  return added;
}
