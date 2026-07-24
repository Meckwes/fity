// app/api/checkout/stripe/route.ts
// =================================================================
// FITY — API Route: cria Checkout Session do Stripe
// =================================================================
// POST /api/checkout/stripe
//   Body: { plan: "essencial" | "pro" | "coach", email, name, userId? }
//
// Retorna: { url: "https://checkout.stripe.com/..." } pro frontend
// redirecionar o user pro checkout do Stripe.
// =================================================================

import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

// Map plano -> price_id
const PRICE_IDS: Record<string, string | undefined> = {
  essencial: process.env.STRIPE_PRICE_ESSENCIAL,
  pro: process.env.STRIPE_PRICE_PRO,
  coach: process.env.STRIPE_PRICE_COACH,
};

export async function POST(req: Request) {
  try {
    const { plan, email, name, userId } = await req.json();

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `Plano inv\u00e1lido: ${plan}` },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: "Email obrigat\u00f3rio" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Cria a Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"], // PIX no Brasil requer ativa\u00e7\u00e3o separada
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      // trial_period_days j\u00e1 est\u00e1 configurado no Price (7 dias)
      success_url: `${baseUrl}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout?canceled=1`,
      // Metadata: usado pelo webhook pra saber qual user come\u00e7ou a assinatura
      metadata: {
        userId: userId || "",
        plan,
      },
      subscription_data: {
        metadata: {
          userId: userId || "",
          plan,
        },
      },
      // Permite cupons de desconto (opcional)
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe-checkout] erro:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar checkout" },
      { status: 500 }
    );
  }
}
