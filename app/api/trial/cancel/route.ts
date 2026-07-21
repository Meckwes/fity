import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// =================================================================
// FITY — API: cancela trial (antes da captura automatica)
// =================================================================
// Chamado quando o user clica em "cancelar trial" no painel dele.
//
// Acao:
//   1. Marca trial como 'cancelled' no Supabase
//   2. Chama MP pra cancelar a payment autorizada
//
// Body esperado: { payment_id: number, email: string }
//   - payment_id: ID da payment (capture=false)
//   - email: pra confirmar que e o dono da conta
// =================================================================

export const dynamic = "force-dynamic";

type CancelBody = {
  payment_id: number;
  email: string;
};

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "MP_ACCESS_TOKEN nao configurado" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as CancelBody;
    if (!body.payment_id || !body.email) {
      return NextResponse.json(
        { error: "payment_id e email sao obrigatorios" },
        { status: 400 }
      );
    }

    // 1. Busca trial no Supabase
    const { data: trial, error: queryErr } = await supabaseAdmin
      .from("trials")
      .select("*")
      .eq("payment_id", body.payment_id)
      .eq("customer_email", body.email)
      .single();

    if (queryErr || !trial) {
      return NextResponse.json(
        { error: "Trial nao encontrado pra esse email" },
        { status: 404 }
      );
    }

    if (trial.status === "cancelled") {
      return NextResponse.json({
        ok: true,
        message: "Trial ja estava cancelado",
        already_cancelled: true,
      });
    }

    if (trial.status === "captured") {
      return NextResponse.json(
        {
          error: "Trial ja foi cobrado. Pra cancelar a assinatura, use o painel.",
        },
        { status: 400 }
      );
    }

    // 2. Cancela a payment autorizada no MP
    // capture=false cria payment com status=authorized. Pra cancelar
    // antes do capture, chama o endpoint de refund (estorna a reserva).
    console.log(
      `[trial/cancel] cancelando payment ${body.payment_id} no MP...`
    );

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${body.payment_id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          status: "cancelled",
        }),
      }
    );

    const mpData = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok) {
      console.error(
        `[trial/cancel] MP rejeitou cancelamento: HTTP ${mpRes.status}`,
        mpData
      );
      return NextResponse.json(
        {
          error: "Nao foi possivel cancelar no MP. Tenta de novo.",
          mp_status: mpRes.status,
          mp_error: mpData?.message,
        },
        { status: mpRes.status }
      );
    }

    // 3. Marca no Supabase
    await supabaseAdmin
      .from("trials")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", trial.id);

    console.log(
      `[trial/cancel] trial ${trial.id} cancelado (payment ${body.payment_id})`
    );

    return NextResponse.json({
      ok: true,
      message: "Trial cancelado. Nada sera cobrado no seu cartao.",
      cancelled_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[trial/cancel] ERRO:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
