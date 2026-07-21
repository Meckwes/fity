import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// =================================================================
// FITY — Admin: lista leads + customers (vendas) + conversas
// =================================================================
// Endpoint simples pra alimentar o admin panel em /admin.
// Sem auth por enquanto (MVP) - em prod a gente bota um password.
//
// Retorna: { leads, customers, conversations, stats }
// =================================================================

export async function GET() {
  try {
    // Busca em paralelo
    const [leadsRes, customersRes, conversationsRes] = await Promise.all([
      supabaseAdmin
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("users")
        .select("id, name, email, phone, current_plan, subscription_status, last_payment_amount, subscribed_at, last_payment_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("conversations")
        .select("id, user_id, role, content, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const leads = leadsRes.data || [];
    const customers = customersRes.data || [];
    const conversations = conversationsRes.data || [];

    // Stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalLeads = leads.length;
    const totalCustomers = customers.length;
    const activeSubs = customers.filter(
      (c) => c.subscription_status === "active"
    ).length;

    const allCustomersPaid = customers.filter(
      (c) => c.last_payment_amount
    );
    const totalRevenue = allCustomersPaid.reduce(
      (sum, c) => sum + (c.last_payment_amount || 0),
      0
    );

    const thisMonthRevenue = allCustomersPaid
      .filter((c) => {
        if (!c.last_payment_at) return false;
        return new Date(c.last_payment_at) >= startOfMonth;
      })
      .reduce((sum, c) => sum + (c.last_payment_amount || 0), 0);

    return NextResponse.json({
      ok: true,
      stats: {
        totalLeads,
        totalCustomers,
        activeSubs,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        thisMonthRevenue: Number(thisMonthRevenue.toFixed(2)),
        currency: "BRL",
      },
      leads,
      customers,
      conversations,
    });
  } catch (err) {
    console.error("[admin] erro:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
