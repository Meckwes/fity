// scripts/list-all-users.mjs
// Lista TODOS os users com detalhe
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await supabase
  .from("users")
  .select("id, name, email, phone, subscription_status, subscription_plan, stripe_customer_id, created_at, updated_at")
  .order("updated_at", { ascending: false });

if (error) { console.error("ERRO:", error); process.exit(1); }

console.log(`Total: ${data.length} user(s)\n`);
for (const u of data) {
  console.log("---");
  console.log("ID:        ", u.id);
  console.log("Name:      ", u.name);
  console.log("Email:     ", u.email || "(vazio)");
  console.log("Phone:     ", u.phone || "(vazio)");
  console.log("Status:    ", u.subscription_status || "(nenhum)");
  console.log("Plan:      ", u.subscription_plan || "(nenhum)");
  console.log("Customer:  ", u.stripe_customer_id || "(vazio)");
  console.log("Created:   ", u.created_at);
  console.log("Updated:   ", u.updated_at);
}
