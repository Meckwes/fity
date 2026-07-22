// =================================================================
// FITY — Cron: check-trial-ended
// =================================================================
// Roda 1x por dia. Configurar em vercel.json.
//
// Procura usuarios com trial_started_at + 7 dias <= hoje e que ainda
// nao foram notificados, e manda uma msg via bot avisando que o trial
// acabou + link de pagamento.
//
// IMPORTANTE: autorizado via VERCEL_CRON_SECRET (header Authorization:
// Bearer $VERCEL_CRON_SECRET). Em dev/localhost, deixa passar.
// =================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

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

/**
 * Helper: extrai o primeiro nome do user, tratando placeholders
 * e capitalizando corretamente.
 *
 * "Pedro" -> "Pedro"
 * "pedro silva" -> "Pedro"
 * "." -> "amigo" (fallback)
 * "Usuario sem nome" -> "amigo" (fallback)
 * "" -> "amigo" (fallback)
 * null -> "amigo" (fallback)
 */
function getFirstName(name: string | null | undefined): string {
  if (!name) return "amigo";
  const trimmed = name.trim();
  // Trata placeholders / nomes invalidos
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === "Usuario sem nome" ||
    trimmed === "Usuario Sem Nome" ||
    trimmed.length < 2
  ) {
    return "amigo";
  }
  // Pega so o primeiro nome e capitaliza
  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

type User = {
  id: string;
  phone: string | null;
  lid: string | null;
  name: string | null;
  trial_started_at: string | null;
  trial_ended_notified: boolean;
};

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  console.log(`[cron check-trial-ended] started at ${now.toISOString()}`);
  console.log(
    `[cron check-trial-ended] trials iniciados ANTES de ${sevenDaysAgo.toISOString()} sao candidatos`
  );

  const results = {
    notifications_sent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // =================================================================
  // 1) Buscar trials expirados (7+ dias e nao notificados)
  // =================================================================
  const { data: users, error: queryErr } = await supabaseAdmin
    .from("users")
    .select(
      "id, phone, lid, name, trial_started_at, trial_ended_notified"
    )
    .lte("trial_started_at", sevenDaysAgo.toISOString())
    .eq("trial_ended_notified", false)
    .not("trial_started_at", "is", null);

  if (queryErr) {
    console.error(
      "[cron check-trial-ended] erro na query:",
      queryErr
    );
    return NextResponse.json(
      { error: queryErr.message },
      { status: 500 }
    );
  }

  if (!users || users.length === 0) {
    console.log("[cron check-trial-ended] nenhum trial expirado hoje");
    return NextResponse.json({ ok: true, ...results });
  }

  console.log(
    `[cron check-trial-ended] ${users.length} trial(s) expirado(s) pra notificar`
  );

  // =================================================================
  // 2) Configuracao do bot + URL de checkout
  // =================================================================
  const botUrl = process.env.WHATSAPP_BOT_URL;
  const botApiKey = process.env.WHATSAPP_BOT_API_KEY;
  const fityBaseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://fityai.vercel.app";

  if (!botUrl || !botApiKey) {
    return NextResponse.json(
      { error: "WHATSAPP_BOT_URL ou WHATSAPP_BOT_API_KEY nao configuradas" },
      { status: 500 }
    );
  }

  // =================================================================
  // 3) Mandar msg pra cada user
  // =================================================================
  for (const user of users as User[]) {
    try {
      if (!user.lid) {
        console.warn(
          `[cron check-trial-ended] user ${user.id} sem LID, pulando`
        );
        results.skipped++;
        continue;
      }

      const firstName = getFirstName(user.name);
      const checkoutLink = `${fityBaseUrl}/checkout?renewal=1`;

      const message =
        `E aí, ${firstName}! 🎉\n\n` +
        `Seus 7 dias de teste na Fity acabaram.\n\n` +
        `Curtiu ter um personal no Zap todo dia? Se sim, é só renovar aqui:\n` +
        `👉 ${checkoutLink}\n\n` +
        `Se não rolou, sem problema — sua conta fica aberta por mais 7 dias pra você decidir com calma. Sem pressão, sem multa.\n\n` +
        `Qualquer dúvida, é só mandar msg aqui que a gente conversa. 💪`;

      // POST pro bot mandar a msg (LID direto, sem lookup)
      const res = await fetch(`${botUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${botApiKey}`,
        },
        body: JSON.stringify({
          phone: user.lid,
          message,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(
          `[cron check-trial-ended] erro ao mandar msg (user ${user.id}): ${errText}`
        );
        results.errors.push(`send_${user.id}: ${errText.slice(0, 200)}`);
        continue;
      }

      // Marca como notificado (idempotente)
      const { error: updateErr } = await supabaseAdmin
        .from("users")
        .update({ trial_ended_notified: true })
        .eq("id", user.id);

      if (updateErr) {
        console.error(
          `[cron check-trial-ended] erro ao marcar como notificado (user ${user.id}):`,
          updateErr
        );
        results.errors.push(`update_${user.id}: ${updateErr.message}`);
        continue;
      }

      results.notifications_sent++;
      console.log(
        `[cron check-trial-ended] notificado: user=${user.id} name=${user.name} lid=${user.lid}`
      );
    } catch (err) {
      console.error(
        `[cron check-trial-ended] erro no user ${user.id}:`,
        err
      );
      results.errors.push(`user_${user.id}: ${String(err)}`);
    }
  }

  const duration = Date.now() - startedAt;
  console.log(
    `[cron check-trial-ended] finished em ${duration}ms: ${JSON.stringify(results)}`
  );

  return NextResponse.json({ ok: true, duration_ms: duration, ...results });
}
