import { NextResponse } from "next/server";

// Garante que o Next.js NUNCA faz cache dessa rota.
export const dynamic = "force-dynamic";

// =================================================================
// FITY — API Route: cria preferencia de pagamento no Mercado Pago
// =================================================================
// ABANDONAMOS o SDK `mercadopago` node (v3.2.0) por causa dos multiplos
// bugs de transformacao snake_case/camelCase que estavam corrompendo
// o payload e fazendo o MP rejeitar a preference.
//
// Agora usamos `fetch` direto na API REST do MP, com controle TOTAL
// sobre o JSON que sai. O body e construido como `any` e enviado cru.
//
// Endpoint: https://api.mercadopago.com/checkout/preferences
// =================================================================

type CheckoutPayload = {
  planId: string;
  planName: string;
  description?: string;
  price: number;
  customerEmail?: string;
  customerName?: string;
};

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    // 1. Valida token
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "MP_ACCESS_TOKEN nao configurado no .env.local. Pegue em https://www.mercadopago.com.br/developers/panel/credentials",
        },
        { status: 500 }
      );
    }

    // 2. Parse do body
    const payload = (await req.json()) as CheckoutPayload;
    const {
      planId,
      planName,
      description,
      price,
      customerEmail,
      customerName,
    } = payload;

    // 3. Validacoes basicas
    if (!planId || !planName || !price || price <= 0) {
      return NextResponse.json(
        { error: "planId, planName e price (positivo) sao obrigatorios" },
        { status: 400 }
      );
    }

    // 4. URL base do app (pra back_urls)
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      req.headers.get("origin") ||
      "http://localhost:3000";
    const baseUrl = rawBaseUrl.replace(/\/+$/, ""); // remove barra final

    console.log("[checkout] baseUrl:", baseUrl);

    // Validacao: precisa ser URL absoluta
    if (!/^https?:\/\/.+/.test(baseUrl)) {
      return NextResponse.json(
        {
          error: `NEXT_PUBLIC_BASE_URL invalida: "${baseUrl}". Precisa ser uma URL absoluta (ex: https://fity.com.br). Configure no .env.local.`,
        },
        { status: 500 }
      );
    }

    // 5. Constroi o body da preference — snake_case ESTRITO (API real do MP)
    //    Usando `as any` pra evitar qualquer transformacao automatica
    const mpBody: any = {
      items: [
        {
          id: planId,
          title: planName,
          description:
            description || `Assinatura mensal do plano ${planName}`,
          quantity: 1,
          unit_price: price,
          currency_id: "BRL",
          category_id: "services",
        },
      ],
      // URLs de retorno (MP usa pra redirecionar APOS o pagamento)
      back_urls: {
        success: `${baseUrl}/checkout/success`,
        failure: `${baseUrl}/checkout/failure`,
        pending: `${baseUrl}/checkout/pending`,
      },
      // NOTA: auto_return REMOVIDO por enquanto.
      // O MP rejeita com "back_url.success must be defined" quando auto_return
      // esta setado com URLs HTTP (localhost). Em PRODUCAO com HTTPS, pode
      // reativar trocando a condicao abaixo.
      // Para reativar em prod: process.env.NODE_ENV === "production"
      //   ? { auto_return: "approved" }
      //   : {},
      // Payer (opcional mas recomendado pro PIX pre-preenchido)
      // NOTA: so enviamos o EMAIL. O nome NAO vai pra preference porque
      // aparece na pagina hospedada do MP ("Otimize Tecnologia - Maria Silva")
      // e fica esquisito. O email eh essencial pro PIX ja vir preenchido
      // pro comprador (QR code chega direto).
      payer: customerEmail
        ? {
            email: customerEmail,
          }
        : undefined,
      // Permissoes de pagamento
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12,
      },
      // Webhook de notificacao
      notification_url: "https://fity-app.com/api/webhooks/mercadopago",
      // Metadata pra reconciliacao
      metadata: {
        plan_id: planId,
        plan_name: planName,
        source: "fity_app",
      },
      // Expira em 1 dia
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    // Log do body INTEIRO pra debug
    console.log(
      "[checkout] FULL mpBody:",
      JSON.stringify(mpBody, null, 2)
    );

    // 6. Chama a API do Mercado Pago DIRETAMENTE (sem SDK)
    const mpResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(mpBody),
      }
    );

    // 7. Parse da resposta
    const responseText = await mpResponse.text();
    let mpData: any;
    try {
      mpData = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Resposta do MP nao e JSON valido",
          status: mpResponse.status,
          raw: responseText.slice(0, 500),
          duration_ms: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    // 8. Verifica se deu certo
    if (!mpResponse.ok) {
      console.error(
        "[checkout] MP rejeitou a preference:",
        mpResponse.status,
        JSON.stringify(mpData).slice(0, 500)
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            mpData?.message ||
            mpData?.error ||
            `MP retornou HTTP ${mpResponse.status}`,
          status: mpResponse.status,
          detalhes: mpData,
          duration_ms: Date.now() - startedAt,
        },
        { status: mpResponse.ok ? 200 : 400 }
      );
    }

    // 9. Sucesso
    console.log(
      `[checkout] preference criada: ${mpData.id} em ${Date.now() - startedAt}ms`
    );

    return NextResponse.json({
      ok: true,
      preferenceId: mpData.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("[checkout] erro fatal:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    rota: "/api/checkout",
    metodo_esperado: "POST",
    body_esperado: {
      planId: "essencial | pro | coach",
      planName: "Fity Pro",
      price: 49.0,
      description: "opcional",
      customerEmail: "obrigatorio",
      customerName: "obrigatorio",
    },
    env_var_necessaria: "MP_ACCESS_TOKEN (server-side)",
    onde_pegar: "https://www.mercadopago.com.br/developers/panel/credentials",
  });
}