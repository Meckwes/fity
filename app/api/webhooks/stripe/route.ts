// app/api/webhooks/stripe/route.ts
// =================================================================
// FITY — Webhook do Stripe
// =================================================================
// POST /api/webhooks/stripe
// Recebe eventos do Stripe (subscription created, updated, deleted, etc)
// e atualiza o user no Supabase.
//
// COMO CONFIGURAR:
// 1. Stripe Dashboard -> Workbench -> Webhooks -> Add destination
// 2. URL: https://fityai.vercel.app/api/webhooks/stripe
// 3. Eventos: checkout.session.completed, customer.subscription.created,
//             customer.subscription.updated, customer.subscription.deleted
// 4. Copia o "Signing secret" e adiciona no .env.local como STRIPE_WEBHOOK_SECRET
//
// COMPORTAMENTO:
// - Se o checkout session tiver metadata.userId preenchido (veio do Zap
//   com user ja onboarded) -> atualiza direto por id.
// - Se nao tiver (veio do checkout do site, sem user) -> procura o user
//   por email no Supabase. Se nao existir, cria um novo.
// =================================================================

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper: manda msg de boas-vindas pro Zap do user
async function sendWhatsappWelcome(userId: string) {
  try {
    // Busca o user pra pegar o phone e o name atualizados
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("name, phone")
      .eq("id", userId)
      .maybeSingle();
    if (!user) {
      console.warn(`[stripe-webhook] user ${userId} nao encontrado no Supabase`);
      return;
    }
    if (!user.phone) {
      console.warn(`[stripe-webhook] user ${userId} (${user.name || "sem nome"}) sem phone, skip welcome msg`);
      return;
    }

    const firstName = (user.name || "amigo(a)").split(" ")[0];
    const message =
      `E aí, ${firstName}! 🎉 Seja muito bem-vindo ao Fity AI.\n\n` +
      `A partir de amanhã, todos os dias às 7h, você vai receber seu briefing personalizado com treino, alimentação e orientações para manter sua evolução.\n\n` +
      `Seu roteiro, Sua Evolução começa agora. 💚`;

    const botUrl = process.env.WHATSAPP_BOT_URL;
    const botKey = process.env.WHATSAPP_BOT_API_KEY;
    if (!botUrl || !botKey) {
      console.warn("[stripe-webhook] bot nao configurado, skip welcome msg");
      return;
    }

    const res = await fetch(`${botUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botKey}`,
      },
      body: JSON.stringify({ phone: user.phone, message }),
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`[stripe-webhook] welcome msg enviada pra ${user.phone} (user ${userId})`);
    } else {
      console.error(`[stripe-webhook] erro enviando welcome msg: ${res.status} ${JSON.stringify(result)}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook] erro inesperado no welcome: ${err}`);
  }
}

// Helper: acha o user por id, customer_id, email, phone, ou cria um novo
async function findOrCreateUser(opts: {
  userId?: string | null;
  stripeCustomerId?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}): Promise<string | null> {
  const { userId, stripeCustomerId, email, name, phone } = opts;

  // 1) tenta por id (metadata.userId)
  if (userId) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (data) return data.id;
  }

  // 2) tenta por stripe_customer_id (cobre o caso de eventos de subscription
  //    que vem depois do checkout.session.completed, que JÁ salvou o customer_id)
  if (stripeCustomerId) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (data) return data.id;
  }

  // 3) tenta por email (cobre caso do checkout do site sem userId)
  if (email) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data) return data.id;
  }

  // 4) tenta por phone (cobre caso do mesmo Zap checkoutar 2x com emails
  //    diferentes — o users.phone é UNIQUE, entao a gente assume que é o
  //    mesmo user e faz merge)
  if (phone) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (data) {
      console.log(`[stripe-webhook] user encontrado por phone: ${data.id} (phone ${phone}, email ${email || "(novo)"})`);
      return data.id;
    }
  }

  // 5) nao existe -> cria (pode falhar se phone ja existir — a gente loga
  //    o erro, mas tenta de novo via update pelo phone)
  if (email || phone) {
    const { data: created, error } = await supabaseAdmin
      .from("users")
      .insert({
        email: email || null,
        name: name || (email ? email.split("@")[0] : "Usuario sem nome"),
        phone: phone || null,
        onboarding_completed: false,
        active: true,
      })
      .select("id")
      .single();
    if (!error && created) {
      console.log(`[stripe-webhook] user criado: ${created.id} (${email || phone})`);
      return created.id;
    }
    if (error) {
      console.error(`[stripe-webhook] erro criando user: ${error.message}`);
      // Se falhou por unique constraint no phone, tenta achar o user
      // existente e fazer merge
      if (phone && error.message.includes("users_phone_key")) {
        const { data: existing } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();
        if (existing) {
          console.log(`[stripe-webhook] merge via phone apos unique constraint: ${existing.id}`);
          return existing.id;
        }
      }
    }
  }

  return null;
}

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
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        const sessionPhone = session.metadata?.phone;
        const sessionName = session.customer_details?.name || session.metadata?.name;

        const userId = await findOrCreateUser({
          userId: session.metadata?.userId,
          stripeCustomerId: customerId,
          email: session.customer_email || session.customer_details?.email,
          name: sessionName,
          phone: sessionPhone,
        });

        if (userId && customerId) {
          await supabaseAdmin
            .from("users")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: "active",
              subscription_plan: session.metadata?.plan,
              // Sempre atualiza phone/name se metadata tiver (corrige race condition
              // onde o customer.subscription.created cria o user antes do phone)
              ...(sessionPhone ? { phone: sessionPhone } : {}),
              ...(sessionName ? { name: sessionName } : {}),
            })
            .eq("id", userId);
          console.log(`[stripe-webhook] user ${userId} subscribed (plan: ${session.metadata?.plan}, customer: ${customerId}, phone: ${sessionPhone || "(vazio)"})`);
          // Manda msg de boas-vindas no Zap do user
          await sendWhatsappWelcome(userId);
        } else {
          console.warn(`[stripe-webhook] checkout sem user resolvido: userId=${userId} customerId=${customerId}`);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const subPhone = sub.metadata?.phone;

        const userId = await findOrCreateUser({
          userId: sub.metadata?.userId,
          stripeCustomerId: customerId,
          email: sub.metadata?.email,
          name: sub.metadata?.name,
          phone: subPhone,
        });

        if (userId) {
          // current_period_end mudou de lugar nas versoes mais novas do SDK
          // (agora ta em items.data[0] em vez do root)
          const periodEnd = (sub as any).current_period_end ?? sub.items?.data?.[0]?.current_period_end;
          await supabaseAdmin
            .from("users")
            .update({
              stripe_customer_id: customerId,
              subscription_status: sub.status, // active, trialing, past_due, canceled, etc
              ...(periodEnd ? { subscription_current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
              // Se veio phone na metadata, atualiza (cobre caso do user ter sido
              // criado sem phone, antes do checkout.session.completed chegar)
              ...(subPhone ? { phone: subPhone } : {}),
            })
            .eq("id", userId);
          console.log(`[stripe-webhook] sub ${sub.id} -> ${sub.status} (user ${userId}, phone: ${subPhone || "(vazio)"})`);
        } else {
          console.warn(`[stripe-webhook] subscription event sem user resolvido: sub=${sub.id} customer=${customerId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        const userId = await findOrCreateUser({
          userId: sub.metadata?.userId,
          stripeCustomerId: customerId,
          email: sub.metadata?.email,
          name: sub.metadata?.name,
          phone: sub.metadata?.phone,
        });

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
