// app/api/checkout/stripe/route.ts
// =================================================================
// FITY — API Route: cria Checkout Session do Stripe (redirect)
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
  apiVersion: "2026-06-24.dahlia",
});

// Map plano -> price_id
const PRICE_IDS: Record<string, string | undefined> = {
  essencial: process.env.STRIPE_PRICE_ESSENCIAL,
  pro: process.env.STRIPE_PRICE_PRO,
  coach: process.env.STRIPE_PRICE_COACH,
};

export async function POST(req: Request) {
  try {
    const { plan, email, name, userId, cpf } = await req.json();

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `Plano inválido: ${plan}` },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: "Email obrigatório" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Cria a Checkout Session (modo hosted = redireciona pro checkout.stripe.com)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"], // PIX no Brasil requer ativação separada
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      // trial_period_days já está configurado no Price (7 dias)
      success_url: `${baseUrl}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout?canceled=1`,
      // Metadata: usado pelo webhook pra saber qual user começou a assinatura
      metadata: {
        userId: userId || "",
        email: email || "",
        name: name || "",
        plan,
        cpf: cpf || "",
      },
      subscription_data: {
        // Forca o trial de 7 dias (ja ta no Price, mas explicito aqui garante)
        trial_period_days: 7,
        metadata: {
          userId: userId || "",
          email: email || "",
          name: name || "",
          plan,
          cpf: cpf || "",
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
