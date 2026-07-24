// app/api/webhooks/stripe/route.ts
// =================================================================
// FITY — Webhook do Stripe
// =================================================================
// POST /api/webhooks/stripe
// Recebe eventos do Stripe (subscription created, updated, deleted, etc)
// e atualiza o user no Supabase.
//
// COMO CONFIGURAR:
// 1. Stripe Dashboard -> Developers -> Webhooks -> Add endpoint
// 2. URL: https://fityai.vercel.app/api/webhooks/stripe
// 3. Eventos: checkout.session.completed, customer.subscription.updated,
//             customer.subscription.deleted, invoice.paid
// 4. Copia o "Signing secret" e adiciona no .env.local como STRIPE_WEBHOOK_SECRET
// =================================================================

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  if (!webhookSecret || webhookSecret === "PLACEHOLDER_VOUROPDAR_DEPOIS") {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET n\u00e3o configurado");
    return NextResponse.json(
      { error: "Webhook secret n\u00e3o configurado" },
      { status: 500 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Sem assinatura" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] assinatura inv\u00e1lida:", err);
    return NextResponse.json(
      { error: "Assinatura inv\u00e1lida" },
      { status: 400 }
    );
  }

  console.log(`[stripe-webhook] evento: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

        if (userId && customerId) {
          // Marca user como subscribed no Supabase
          await supabaseAdmin
            .from("users")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: "active",
              subscription_plan: session.metadata?.plan,
            })
            .eq("id", userId);
          console.log(`[stripe-webhook] user ${userId} subscribed (plan: ${session.metadata?.plan})`);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await supabaseAdmin
            .from("users")
            .update({
              subscription_status: sub.status, // active, trialing, past_due, canceled, etc
              subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            })
            .eq("id", userId);
          console.log(`[stripe-webhook] sub ${sub.id} -> ${sub.status} (user ${userId})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await supabaseAdmin
            .from("users")
            .update({ subscription_status: "canceled" })
            .eq("id", userId);
          console.log(`[stripe-webhook] user ${userId} cancelou`);
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // Aqui poderia notificar o user via Zap se o pagamento falhou
        console.log(`[stripe-webhook] invoice ${invoice.id} -> ${event.type}`);
        break;
      }
    }
  } catch (err) {
    console.error(`[stripe-webhook] erro ao processar ${event.type}:`, err);
    return NextResponse.json({ error: "Erro ao processar" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
