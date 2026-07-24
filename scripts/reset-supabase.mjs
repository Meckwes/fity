// scripts/reset-supabase.mjs
// =================================================================
// FITY — Limpa TODOS os dados de teste do Supabase
// =================================================================
// APAGA:
//   - users (todos)
//   - conversations (todas)
//   - profiles (todos)
//
// ⚠️  CUIDADO: essa operação é DESTRUTIVA e IRREVERSÍVEL.
//     Só roda quando tiver certeza que quer começar do zero.
//
// COMO RODAR:
//   cd fity-app
//   node scripts/reset-supabase.mjs
// =================================================================

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { createInterface } from "readline";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Faltam env vars (NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Confirmação manual
const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(q) {
  return new Promise((resolve) => rl.question(q, (ans) => resolve(ans)));
}

console.log("🔍 Contando dados atuais...\n");

const { count: usersCount } = await supabase
  .from("users")
  .select("*", { count: "exact", head: true });

const { count: convsCount } = await supabase
  .from("conversations")
  .select("*", { count: "exact", head: true });

const { count: profilesCount } = await supabase
  .from("profiles")
  .select("*", { count: "exact", head: true });

const { count: trialsCount } = await supabase
  .from("trials")
  .select("*", { count: "exact", head: true });

console.log(`   users:        ${usersCount}`);
console.log(`   conversations: ${convsCount}`);
console.log(`   profiles:     ${profilesCount}`);
console.log(`   trials:       ${trialsCount}`);
console.log("");

// Confirmação: prompt OU flag --force OU env CONFIRM
const forceFlag = process.argv.includes("--force") || process.env.CONFIRM === "APAGAR TUDO";

if (!forceFlag) {
  const ans = (await ask("⚠️  Apagar TUDO? Digite 'APAGAR TUDO' pra confirmar: ")).trim();
  if (ans !== "APAGAR TUDO") {
    console.log("\n❌ Cancelado. Nada foi apagado.");
    rl.close();
    process.exit(0);
  }
} else {
  console.log("⚠️  Modo --force: pulando confirmação");
}

console.log("\n🗑️  Apagando...");

// Apaga em ordem (filhas primeiro por causa de FK)
console.log("   - conversations...");
const { error: e1 } = await supabase
  .from("conversations")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all (hack: id != placeholder)
if (e1) console.error(`     ❌ ${e1.message}`);

console.log("   - profiles...");
const { error: e2 } = await supabase
  .from("profiles")
  .delete()
  .neq("user_id", "00000000-0000-0000-0000-000000000000");
if (e2) console.error(`     ❌ ${e2.message}`);

console.log("   - trials...");
const { error: e3 } = await supabase
  .from("trials")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");
if (e3) console.error(`     ❌ ${e3.message}`);

console.log("   - users...");
const { error: e4 } = await supabase
  .from("users")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");
if (e4) console.error(`     ❌ ${e4.message}`);

console.log("\n✅ Pronto! Verificando...");

const { count: u2 } = await supabase.from("users").select("*", { count: "exact", head: true });
const { count: c2 } = await supabase.from("conversations").select("*", { count: "exact", head: true });
const { count: p2 } = await supabase.from("profiles").select("*", { count: "exact", head: true });
const { count: t2 } = await supabase.from("trials").select("*", { count: "exact", head: true });

console.log(`   users:        ${u2}`);
console.log(`   conversations: ${c2}`);
console.log(`   profiles:     ${p2}`);
console.log(`   trials:       ${t2}`);

if (u2 === 0 && c2 === 0 && p2 === 0 && t2 === 0) {
  console.log("\n🎉 Banco zerado. Pode começar do zero!");
} else {
  console.log("\n⚠️  Sobrou alguma coisa (pode ter FK ou RLS bloqueando).");
}

rl.close();
