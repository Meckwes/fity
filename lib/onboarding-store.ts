// =================================================================
// FITY — Store de onboarding (Supabase)
// =================================================================
// Gerencia o state machine do onboarding + persiste os dados
// coletados no profile do usuario.
//
// Fluxo usado pelo webhook:
//   1. usuario manda msg (ainda em onboarding)
//   2. webhook chama getOnboardingState(userId) pra saber em que step ta
//   3. chama generateOnboardingStep() da lib/ai.ts (state machine)
//   4. chama saveOnboardingStep() pra salvar dados extraidos + avancar step
//   5. se is_complete, marca onboarding_completed=true
//   6. proximo dia 7h, briefing diario ja funciona pro user
// =================================================================

import { supabaseAdmin } from "./supabase-admin";
import type { OnboardingExtracted, OnboardingStep } from "./ai";
import { getNextOnboardingStep, titleCase } from "./ai";

function log(...args: any[]) {
  console.log("[onboarding-store]", ...args);
}

export type OnboardingState = {
  step: OnboardingStep;
  completed: boolean;
  name: string | null;
  collectedData: OnboardingExtracted;
};

/**
 * Busca o estado atual do onboarding de um user.
 * Retorna { step, completed, name, collectedData } pra passar pro AI.
 *
 * Se o user NAO tem profile ainda, retorna collectedData={}.
 * Se ja tem profile, hidrata collectedData com o que ja foi salvo antes
 * (assim a IA sabe o que ja perguntou e pode pular etapas).
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  // 1) Pega user (nome + step + completed)
  const { data: userData, error: userErr } = await supabaseAdmin
    .from("users")
    .select("name, onboarding_step, onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  if (userErr) {
    log("ERRO ao buscar user:", userErr.message);
    throw userErr;
  }
  if (!userData) {
    log("user nao encontrado:", userId);
    return { step: "start", completed: false, name: null, collectedData: {} };
  }

  if (userData.onboarding_completed) {
    return { step: "done", completed: true, name: userData.name, collectedData: {} };
  }

  // 2) Pega dados ja coletados no profile (se existir)
  const { data: profileData, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("goal, current_weight_kg, height_cm, equipment, dietary_restrictions, workout_time")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr) {
    log("AVISO ao buscar profile (pode nao existir ainda):", profileErr.message);
  }

  const collectedData: OnboardingExtracted = {};
  if (profileData) {
    if (profileData.goal) collectedData.goal = profileData.goal as OnboardingExtracted["goal"];
    if (profileData.current_weight_kg) collectedData.current_weight_kg = Number(profileData.current_weight_kg);
    if (profileData.height_cm) collectedData.height_cm = Number(profileData.height_cm);
    if (profileData.equipment) collectedData.equipment = profileData.equipment;
    if (profileData.dietary_restrictions) collectedData.dietary_restrictions = profileData.dietary_restrictions;
    if (profileData.workout_time) collectedData.workout_time = profileData.workout_time as OnboardingExtracted["workout_time"];
  }

  return {
    step: (userData.onboarding_step as OnboardingStep) || "start",
    completed: false,
    name: userData.name,
    collectedData,
  };
}

/**
 * Salva os dados extraidos de uma etapa do onboarding.
 * - Atualiza (ou cria) a linha em profiles com os dados novos
 * - Avanca users.onboarding_step (start -> goal -> weight -> ... -> done)
 * - Se is_complete, marca users.onboarding_completed=true
 *
 * @returns { newStep, completed }
 */
export async function saveOnboardingStep(
  userId: string,
  currentStep: OnboardingStep,
  extracted: OnboardingExtracted,
  isComplete: boolean
): Promise<{ newStep: OnboardingStep; completed: boolean }> {
  // 1) Monta update de profile (so com os campos que vieram no extracted)
  const profileUpdate: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (extracted) {
    if (extracted.goal) profileUpdate.goal = extracted.goal;
    if (extracted.current_weight_kg !== undefined) profileUpdate.current_weight_kg = extracted.current_weight_kg;
    if (extracted.height_cm !== undefined) profileUpdate.height_cm = extracted.height_cm;
    if (extracted.equipment) profileUpdate.equipment = extracted.equipment;
    if (extracted.dietary_restrictions) profileUpdate.dietary_restrictions = extracted.dietary_restrictions;
    if (extracted.workout_time) profileUpdate.workout_time = extracted.workout_time;
  }

  // 2) UPSERT no profile (cria se nao existe, atualiza se ja tem)
  if (Object.keys(profileUpdate).length > 1) {
    // > 1 porque sempre tem updated_at
    const { error: upsertErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: userId, ...profileUpdate },
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      log("ERRO ao salvar profile no onboarding:", upsertErr.message);
    }
  }

  // 3) Calcula novo step
  const newStep: OnboardingStep = isComplete ? "done" : getNextOnboardingStep(currentStep);
  const completed = isComplete || newStep === "done";

  // 4) Atualiza user (incluindo o nome se veio do onboarding)
  const userUpdate: Record<string, any> = { onboarding_step: newStep };
  if (completed) {
    userUpdate.onboarding_completed = true;
  }
  // Se a IA extraiu o nome do user, salva capitalizado em users.name
  // (sobrescreve o placeholder que veio do WhatsApp push name)
  if (extracted && extracted.name) {
    const cleanName = titleCase(extracted.name.trim());
    if (cleanName && cleanName !== "." && cleanName !== "Usuario Sem Nome") {
      userUpdate.name = cleanName;
      log("nome atualizado:", cleanName, "(era:", userUpdate.name, ")");
    }
  }

  const { error: userErr } = await supabaseAdmin
    .from("users")
    .update(userUpdate)
    .eq("id", userId);

  if (userErr) {
    log("ERRO ao atualizar onboarding_step:", userErr.message);
    throw userErr;
  }

  log(
    `onboarding salvo: step ${currentStep} -> ${newStep} | completed=${completed} | campos salvos: ${Object.keys(extracted || {}).join(", ") || "(nenhum)"}`
  );
  return { newStep, completed };
}
