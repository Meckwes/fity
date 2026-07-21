import { NextResponse } from "next/server";

// =================================================================
// FITY — API: consulta status de um pagamento (usado pro polling do PIX)
// =================================================================
// O PIX e async: depois de gerar o QR code, o user paga no app do banco
// e a gente precisa saber quando o status muda pra "approved".
// O frontend faz polling desse endpoint a cada 3s.
// =================================================================

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "MP_ACCESS_TOKEN nao configurado" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("payment_id");

    if (!paymentId) {
      return NextResponse.json(
        { error: "payment_id obrigatorio" },
        { status: 400 }
      );
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!mpResponse.ok) {
      return NextResponse.json(
        { error: `MP retornou HTTP ${mpResponse.status}` },
        { status: mpResponse.status }
      );
    }

    const mpData: any = await mpResponse.json();

    return NextResponse.json({
      ok: true,
      paymentId: mpData.id,
      status: mpData.status,
      status_detail: mpData.status_detail,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
