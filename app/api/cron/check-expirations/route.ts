import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTemplateMessage } from "@/lib/whatsapp";

// =================================================================
// FITY — Cron: check-expirations (renovacao manual via WhatsApp)
// =================================================================
// Roda 1x por dia. Configurado em vercel.json.
//
// Tarefas (3 olas, todas idempotentes):
//   1. AVISO 1 dia antes: trials com expires_at entre agora e amanha
//      + status='captured' + renewal_reminder_sent=false
//      -> manda WhatsApp fity_renovacao com link de pagamento
//      -> marca renewal_reminder_sent=true
//
//   2. PAUSAR expirado hoje: trials com expires_at < agora
//      + status='captured'
//      -> muda status='paused' (briefing das 7h pula esse user)
//      -> manda WhatsApp avisando que pausou + link pra reativar
//
//   3. EXPIRAR: trials com expires_at < agora - 7 dias (ja teve
//      chance de renovar e nada aconteceu)
//      -> muda status='expired' (estado terminal — nao manda mais nada)
//
// RENOVACAO: a renovacao em si acontece quando o user clica no link
// do WhatsApp, paga via /checkout?paynow=1, e o webhook do MP detecta
// o pagamento aprovado e chama o endpoint de extensao (ver
// app/api/webhooks/mercadopago/route.ts).
// =================================================================

export const dynamic = "force-dynamic";

type Trial = {
  id: string;
  payment_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  plan_id: string;
  plan_name: string;
  amount: number;
  expires_at: string;
  renewal_reminder_sent: boolean;
  status: string;
  paused_at: string | null;
};

// Helper: checa autorizacao do cron
function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const auth = req.headers.get("authorization");
  const expected = process.env.VERCEL_CRON_SECRET;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

// Helper: formata data em pt-BR
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Helper: monta URL de renovacao pro user
function buildRenewalLink(
  planId: string,
  email: string
): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const params = new URLSearchParams({
    plan: planId,
    paynow: "1",
    email: email,
  });
  return `${baseUrl}/checkout?${params.toString()}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`[cron check-expirations] started at ${now.toISOString()}`);

  const results = {
    reminders_sent: 0,
    paused: 0,
    expired: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // =================================================================
  // OLA 1: AVISO DE RENOVACAO (1 dia antes)
  // =================================================================
  try {
    const { data: trialsToRemind, error: remindErr } = await supabaseAdmin
      .from("trials")
      .select("*")
      .eq("status", "captured")
      .eq("renewal_reminder_sent", false)
      .gte("expires_at", now.toISOString())
      .lte("expires_at", tomorrow.toISOString());

    if (remindErr) {
      console.error(
        "[cron check-expirations] erro ao buscar trials pra avisar:",
        remindErr
      );
      results.errors.push(`remind_query: ${remindErr.message}`);
    } else if (trialsToRemind && trialsToRemind.length > 0) {
      console.log(
        `[cron check-expirations] ${trialsToRemind.length} trial(s) pra avisar`
      );

      for (const trial of trialsToRemind as Trial[]) {
        try {
          if (!trial.customer_phone) {
            console.warn(
              `[cron check-expirations] trial ${trial.id} sem telefone, pulando`
            );
            results.skipped++;
            continue;
          }

          const renewalLink = buildRenewalLink(
            trial.plan_id,
            trial.customer_email
          );

          // Template: precisa existir no Meta Business
          // Variaveis: {{1}} nome, {{2}} plano, {{3}} valor, {{4}} link
          try {
            await sendTemplateMessage(
              trial.customer_phone,
              "fity_renovacao",
              "pt_BR",
              [
                trial.customer_name.split(" ")[0], // primeiro nome
                trial.plan_name,
                Number(trial.amount).toFixed(2).replace(".", ","),
                renewalLink,
              ]
            );
            console.log(
              `[cron check-expirations] WhatsApp aviso enviado: trial=${trial.id} link=${renewalLink}`
            );
          } catch (waErr) {
            console.error(
              `[cron check-expirations] erro WhatsApp (trial ${trial.id}):`,
              waErr
            );
            // Continua mesmo se o WhatsApp falhar — o pause ainda acontece
          }

          // Marca como avisado (idempotente)
          await supabaseAdmin
            .from("trials")
            .update({ renewal_reminder_sent: true })
            .eq("id", trial.id);

          results.reminders_sent++;
        } catch (err) {
          console.error(
            `[cron check-expirations] erro ao processar trial ${trial.id}:`,
            err
          );
          results.errors.push(`remind_${trial.id}: ${String(err)}`);
        }
      }
    } else {
      console.log("[cron check-expirations] nenhum trial pra avisar hoje");
    }
  } catch (err) {
    console.error("[cron check-expirations] erro geral em reminders:", err);
    results.errors.push(`reminders_general: ${String(err)}`);
  }

  // =================================================================
  // OLA 2: PAUSAR (expires_at < agora e ainda tava captured)
  // =================================================================
  try {
    const { data: trialsToPause, error: pauseErr } = await supabaseAdmin
      .from("trials")
      .select("*")
      .eq("status", "captured")
      .lt("expires_at", now.toISOString());

    if (pauseErr) {
      console.error(
        "[cron check-expirations] erro ao buscar trials pra pausar:",
        pauseErr
      );
      results.errors.push(`pause_query: ${pauseErr.message}`);
    } else if (trialsToPause && trialsToPause.length > 0) {
      console.log(
        `[cron check-expirations] ${trialsToPause.length} trial(s) pra pausar`
      );

      for (const trial of trialsToPause as Trial[]) {
        try {
          const renewalLink = buildRenewalLink(
            trial.plan_id,
            trial.customer_email
          );

          // Pausa no Supabase
          await supabaseAdmin
            .from("trials")
            .update({
              status: "paused",
              paused_at: now.toISOString(),
            })
            .eq("id", trial.id);

          console.log(
            `[cron check-expirations] trial ${trial.id} pausado (expires_at era ${trial.expires_at})`
          );

          // Avisa o user que pausou (se tiver telefone)
          if (trial.customer_phone) {
            try {
              await sendTemplateMessage(
                trial.customer_phone,
                "fity_renovacao_pausado", // template diferente (mais urgente)
                "pt_BR",
                [
                  trial.customer_name.split(" ")[0],
                  trial.plan_name,
                  Number(trial.amount).toFixed(2).replace(".", ","),
                  renewalLink,
                ]
              );
            } catch (waErr) {
              console.error(
                `[cron check-expirations] erro WhatsApp pausa (trial ${trial.id}):`,
                waErr
              );
            }
          }

          results.paused++;
        } catch (err) {
          console.error(
            `[cron check-expirations] erro ao pausar trial ${trial.id}:`,
            err
          );
          results.errors.push(`pause_${trial.id}: ${String(err)}`);
        }
      }
    } else {
      console.log("[cron check-expirations] nenhum trial pra pausar hoje");
    }
  } catch (err) {
    console.error("[cron check-expirations] erro geral em pauses:", err);
    results.errors.push(`pauses_general: ${String(err)}`);
  }

  // =================================================================
  // OLA 3: EXPIRAR (paused por mais de 7 dias = desistiu)
  // =================================================================
  try {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: trialsToExpire, error: expireErr } = await supabaseAdmin
      .from("trials")
      .select("*")
      .eq("status", "paused")
      .lt("paused_at", sevenDaysAgo.toISOString());

    if (expireErr) {
      console.error(
        "[cron check-expirations] erro ao buscar trials pra expirar:",
        expireErr
      );
      results.errors.push(`expire_query: ${expireErr.message}`);
    } else if (trialsToExpire && trialsToExpire.length > 0) {
      console.log(
        `[cron check-expirations] ${trialsToExpire.length} trial(s) pra expirar`
      );

      for (const trial of trialsToExpire as Trial[]) {
        try {
          await supabaseAdmin
            .from("trials")
            .update({ status: "expired" })
            .eq("id", trial.id);
          console.log(
            `[cron check-expirations] trial ${trial.id} expirado (paused_at=${trial.paused_at})`
          );
          results.expired++;
        } catch (err) {
          console.error(
            `[cron check-expirations] erro ao expirar trial ${trial.id}:`,
            err
          );
          results.errors.push(`expire_${trial.id}: ${String(err)}`);
        }
      }
    } else {
      console.log("[cron check-expirations] nenhum trial pra expirar hoje");
    }
  } catch (err) {
    console.error("[cron check-expirations] erro geral em expires:", err);
    results.errors.push(`expires_general: ${String(err)}`);
  }

  const duration = Date.now() - startedAt;
  console.log(
    `[cron check-expirations] finished em ${duration}ms: ${JSON.stringify(results)}`
  );

  return NextResponse.json({
    ok: true,
    duration_ms: duration,
    ...results,
  });
}
