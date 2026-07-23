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

// =================================================================
// BRIEFING RECIPIENTS (B+7.1 — bug fix trial)
// =================================================================
// A getActiveSubscribers() original SÓ retornava usuarios PAGOS
// (trials.status='captured'). Isso deixava trial users sem briefing
// durante os 7 dias gratis — ou seja, o trial nao tinha valor.
//
// Essa nova funcao retorna TODOS os elegiveis:
//   - PAGOS: trials.status='captured' AND expires_at > now
//   - TRIAL: users.onboarding_completed=true AND trial_started_at
//            dentro dos ultimos 7 dias
// =================================================================

export type BriefingRecipient = {
  user_id: string;
  phone: string;
  name: string;
  source: "paid" | "trial";
};

/**
 * Retorna todos os usuarios que devem receber o briefing diario das 7h.
 * Unifica: assinantes pagos (via trials) + trial users (via users).
 *
 * @example
 *   const r = await getEligibleBriefingRecipients();
 *   // r = [
 *   //   { user_id, phone, name, source: "paid" },
 *   //   { user_id, phone, name, source: "trial" },
 *   // ]
 */
export async function getEligibleBriefingRecipients(): Promise<BriefingRecipient[]> {
  const nowISO = new Date().toISOString();
  const sevenDaysAgoISO = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // 1) Pagos (vem da tabela trials)
  const { data: paidTrials, error: paidErr } = await supabaseAdmin
    .from("trials")
    .select("customer_phone, customer_name")
    .eq("status", "captured")
    .gt("expires_at", nowISO);

  if (paidErr) {
    console.error("[briefing-recipients] erro ao buscar trials:", paidErr.message);
  }

  const paidPhones = new Set(
    (paidTrials || [])
      .map((t) => t.customer_phone)
      .filter((p): p is string => Boolean(p))
  );
  const paidNamesByPhone = new Map(
    (paidTrials || [])
      .filter((t) => t.customer_phone)
      .map((t) => [t.customer_phone as string, t.customer_name])
  );

  // 2) Users com onboarding completo (cobre trial E pago pelo users table)
  const { data: users, error: usersErr } = await supabaseAdmin
    .from("users")
    .select("id, phone, name, trial_started_at, onboarding_completed")
    .eq("onboarding_completed", true);

  if (usersErr) {
    console.error("[briefing-recipients] erro ao buscar users:", usersErr.message);
    return [];
  }

  // 3) Filtra: pago (com plano ativo) OU em trial (7 dias)
  const recipients: BriefingRecipient[] = [];
  for (const u of users || []) {
    if (!u.phone) continue;

    if (paidPhones.has(u.phone)) {
      // Assinante pago
      recipients.push({
        user_id: u.id,
        phone: u.phone,
        name: paidNamesByPhone.get(u.phone) || u.name || "amigo(a)",
        source: "paid",
      });
    } else if (u.trial_started_at && u.trial_started_at >= sevenDaysAgoISO) {
      // Em trial (ainda dentro dos 7 dias gratis)
      recipients.push({
        user_id: u.id,
        phone: u.phone,
        name: u.name || "amigo(a)",
        source: "trial",
      });
    }
    // Se nao ta pago nem em trial, pula (trial ja expirou, sem pagamento)
  }

  console.log(
    `[briefing-recipients] ${recipients.length} elegivel(is): ` +
    `${recipients.filter((r) => r.source === "paid").length} pago(s), ` +
    `${recipients.filter((r) => r.source === "trial").length} trial(s)`
  );

  return recipients;
}
