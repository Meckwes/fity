import { supabaseAdmin } from "./supabase-admin";

// =================================================================
// FITY — Subscription helper
// =================================================================
// Centraliza a logica de "quem ta com a assinatura ativa" pra outros
// lugares do sistema usarem (briefing diario, painel admin, etc).
//
// Status possiveis do trial (subscription):
//   - 'active'    = trial rolando, ainda nao foi capturado (so primeiros 7 dias)
//   - 'captured'  = pago, com acesso (ciclo de 30 dias rolando)
//   - 'paused'    = ciclo de 30 dias expirou, mas pode renovar
//   - 'expired'   = pausado por mais de 7 dias, desistencia confirmada
//   - 'cancelled' = user cancelou o trial antes do capture
//   - 'failed'    = capture do trial falhou (cartao recusado etc)
//
// REGRA DE OURO: user com status 'captured' = recebe briefing.
// Qualquer outro status = NAO recebe briefing.
// =================================================================

export type SubscriptionStatus =
  | "active"
  | "captured"
  | "paused"
  | "expired"
  | "cancelled"
  | "failed";

export type Subscription = {
  id: string;
  customer_email: string;
  customer_phone: string | null;
  customer_name: string;
  plan_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  expires_at: string | null;
  captured_at: string | null;
  paused_at: string | null;
};

/**
 * Retorna todos os usuarios com assinatura ATIVA (recebem briefing).
 * "Ativa" = status='captured' E expires_at > agora.
 *
 * Use isso no script de IA das 7h antes de gerar briefings.
 */
export async function getActiveSubscribers(): Promise<Subscription[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("trials")
    .select(
      "id, customer_email, customer_phone, customer_name, plan_id, plan_name, status, expires_at, captured_at, paused_at"
    )
    .eq("status", "captured")
    .gt("expires_at", now);

  if (error) {
    console.error("[subscription] erro ao buscar ativos:", error);
    return [];
  }

  return (data || []) as Subscription[];
}

/**
 * Verifica se um email especifico tem assinatura ativa.
 * Retorna a subscription se ativa, null se nao.
 */
export async function getActiveSubscriptionByEmail(
  email: string
): Promise<Subscription | null> {
  if (!email) return null;
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("trials")
    .select(
      "id, customer_email, customer_phone, customer_name, plan_id, plan_name, status, expires_at, captured_at, paused_at"
    )
    .eq("customer_email", email)
    .eq("status", "captured")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[subscription] erro ao buscar por email:", error);
    return null;
  }

  return (data as Subscription) || null;
}

/**
 * Retorna todos os usuarios com assinatura PAUSADA.
 * Util pra campanhas de reativacao ("quer voltar?").
 */
export async function getPausedSubscribers(): Promise<Subscription[]> {
  const { data, error } = await supabaseAdmin
    .from("trials")
    .select(
      "id, customer_email, customer_phone, customer_name, plan_id, plan_name, status, expires_at, captured_at, paused_at"
    )
    .eq("status", "paused");

  if (error) {
    console.error("[subscription] erro ao buscar pausados:", error);
    return [];
  }

  return (data || []) as Subscription[];
}

/**
 * Helper rapido: user tem acesso ao briefing?
 */
export async function hasActiveAccess(email: string): Promise<boolean> {
  const sub = await getActiveSubscriptionByEmail(email);
  return sub !== null;
}
