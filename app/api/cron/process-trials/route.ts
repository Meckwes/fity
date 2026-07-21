import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTemplateMessage } from "@/lib/whatsapp";

// =================================================================
// FITY — Cron: processa trials (aviso dia 6 + captura dia 7)
// =================================================================
// Roda 1x por dia. Configurar em vercel.json (ou acionar manualmente
// pra teste).
//
// Tarefas:
//   1. AVISO (dia -1): trials com reminder_date = hoje e notified_day6=false
//      → manda WhatsApp avisando que amanha sera cobrado
//      → marca notified_day6 = true
//   2. CAPTURA (dia 0): trials com charge_date = hoje e status = active
//      → chama /v1/payments/{id}/capture no MP
//      → se aprovado: status='captured', libera o usuario
//      → se falhou: status='failed', salva failure_reason
//
// Se o user cancelou antes (status='cancelled'), nada acontece.
//
// IMPORTANTE: autorizado a seguranca via VERCEL_CRON_SECRET
// (header Authorization: Bearer $VERCEL_CRON_SECRET)
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
  charge_date: string;
  reminder_date: string;
  status: string;
  notified_day6: boolean;
};

// Helper pra checar seguranca do cron
function isAuthorized(req: Request): boolean {
  // Em dev/localhost, deixa passar sem checagem
  if (process.env.NODE_ENV !== "production") return true;
  // Em prod, exige VERCEL_CRON_SECRET
  const auth = req.headers.get("authorization");
  const expected = process.env.VERCEL_CRON_SECRET;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

// Helper pra formatar data em pt-BR
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowEnd = new Date(todayStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  console.log(`[cron process-trials] started at ${now.toISOString()}`);

  const results = {
    reminders_sent: 0,
    captures_succeeded: 0,
    captures_failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // =================================================================
  // 1) AVISO (1 dia antes) — mandar WhatsApp avisando
  // =================================================================
  try {
    const { data: trialsToRemind, error: remindErr } = await supabaseAdmin
      .from("trials")
      .select("*")
      .eq("status", "active")
      .eq("notified_day6", false)
      .gte("reminder_date", todayStart.toISOString())
      .lt("reminder_date", tomorrowEnd.toISOString());

    if (remindErr) {
      console.error("[cron process-trials] erro ao buscar trials pra avisar:", remindErr);
      results.errors.push(`remind_query: ${remindErr.message}`);
    } else if (trialsToRemind && trialsToRemind.length > 0) {
      console.log(`[cron process-trials] ${trialsToRemind.length} trial(s) pra avisar`);

      for (const trial of trialsToRemind as Trial[]) {
        try {
          if (!trial.customer_phone) {
            console.warn(
              `[cron process-trials] trial ${trial.id} sem telefone, pulando aviso`
            );
            results.skipped++;
            continue;
          }

          // IMPORTANTE: o template precisa existir no Meta Business
          // (ex: "trial_ending"). Se nao existir, vai dar erro 404.
          // Por enquanto, se der erro, so loga — nao bloqueia o capture.
          try {
            await sendTemplateMessage(
              trial.customer_phone,
              "trial_ending", // nome do template (criar no Meta Business)
              "pt_BR",
              [
                trial.customer_name.split(" ")[0], // primeiro nome
                trial.plan_name,
                Number(trial.amount).toFixed(2).replace(".", ","),
                fmtDate(trial.charge_date),
              ]
            );
            console.log(
              `[cron process-trials] WhatsApp aviso enviado: trial=${trial.id} phone=${trial.customer_phone}`
            );
          } catch (waErr) {
            console.error(
              `[cron process-trials] erro ao mandar WhatsApp (trial ${trial.id}):`,
              waErr
            );
            // Continua mesmo se o WhatsApp falhar — o capture ainda acontece
          }

          // Marca como avisado (idempotente)
          await supabaseAdmin
            .from("trials")
            .update({ notified_day6: true })
            .eq("id", trial.id);

          results.reminders_sent++;
        } catch (err) {
          console.error(
            `[cron process-trials] erro ao processar trial ${trial.id}:`,
            err
          );
          results.errors.push(`remind_${trial.id}: ${String(err)}`);
        }
      }
    } else {
      console.log("[cron process-trials] nenhum trial pra avisar hoje");
    }
  } catch (err) {
    console.error("[cron process-trials] erro geral em reminders:", err);
    results.errors.push(`reminders_general: ${String(err)}`);
  }

  // =================================================================
  // 2) CAPTURA (dia da cobrança) — chamar /capture no MP
  // =================================================================
  try {
    const { data: trialsToCapture, error: captureErr } = await supabaseAdmin
      .from("trials")
      .select("*")
      .eq("status", "active")
      .gte("charge_date", todayStart.toISOString())
      .lt("charge_date", tomorrowEnd.toISOString());

    if (captureErr) {
      console.error(
        "[cron process-trials] erro ao buscar trials pra capturar:",
        captureErr
      );
      results.errors.push(`capture_query: ${captureErr.message}`);
    } else if (trialsToCapture && trialsToCapture.length > 0) {
      console.log(
        `[cron process-trials] ${trialsToCapture.length} trial(s) pra capturar`
      );

      const accessToken = process.env.MP_ACCESS_TOKEN;
      if (!accessToken) {
        return NextResponse.json(
          { error: "MP_ACCESS_TOKEN nao configurado" },
          { status: 500 }
        );
      }

      for (const trial of trialsToCapture as Trial[]) {
        try {
          console.log(
            `[cron process-trials] capturando payment ${trial.payment_id} (trial ${trial.id})...`
          );

          // Chama o endpoint de capture do MP
          const captureRes = await fetch(
            `https://api.mercadopago.com/v1/payments/${trial.payment_id}/capture`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
                "X-Idempotency-Key": `capture-${trial.payment_id}-${Date.now()}`,
              },
            }
          );

          const captureData = await captureRes.json().catch(() => ({}));

          if (captureRes.ok && captureData.status === "approved") {
            // Sucesso: marca como capturado E define expires_at = hoje + 30 dias
            // (inicio do ciclo de 30 dias pago). O cron de expiracao vai
            // usar essa data pra mandar aviso + pausar se nao renovar.
            const capturedAt = new Date();
            const expiresAt = new Date(capturedAt);
            expiresAt.setDate(expiresAt.getDate() + 30);

            await supabaseAdmin
              .from("trials")
              .update({
                status: "captured",
                captured_at: capturedAt.toISOString(),
                expires_at: expiresAt.toISOString(),
                renewal_reminder_sent: false, // reseta pra proxima renovacao
              })
              .eq("id", trial.id);

            console.log(
              `[cron process-trials] ✅ trial ${trial.id} capturado: status=${captureData.status}`
            );
            results.captures_succeeded++;

            // TODO: disparar welcome_fity template aqui
            // (idealmente via webhook do MP, mas pode ser aqui tambem)
          } else {
            // Falhou
            await supabaseAdmin
              .from("trials")
              .update({
                status: "failed",
                failure_reason:
                  captureData?.status_detail ||
                  captureData?.message ||
                  `HTTP ${captureRes.status}`,
              })
              .eq("id", trial.id);

            console.error(
              `[cron process-trials] ❌ trial ${trial.id} falhou: ${JSON.stringify(captureData)}`
            );
            results.captures_failed++;
          }
        } catch (err) {
          console.error(
            `[cron process-trials] erro ao capturar trial ${trial.id}:`,
            err
          );
          results.errors.push(`capture_${trial.id}: ${String(err)}`);
        }
      }
    } else {
      console.log("[cron process-trials] nenhum trial pra capturar hoje");
    }
  } catch (err) {
    console.error("[cron process-trials] erro geral em captures:", err);
    results.errors.push(`captures_general: ${String(err)}`);
  }

  const duration = Date.now() - startedAt;
  console.log(
    `[cron process-trials] finished em ${duration}ms: ${JSON.stringify(results)}`
  );

  return NextResponse.json({
    ok: true,
    duration_ms: duration,
    ...results,
  });
}
