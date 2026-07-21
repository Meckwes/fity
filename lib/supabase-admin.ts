// =================================================================
// FITY — Cliente Supabase ADMIN (service_role)
// ⚠️ NUNCA importe isso num arquivo "use client" ou que vá pro browser
// ⚠️ Use APENAS em API routes e server components (backend Next.js)
// =================================================================
// Por que existe separado?
// - lib/supabase.ts usa a ANON KEY (segura, vai pro browser)
// - lib/supabase-admin.ts usa a SERVICE ROLE (bypassa RLS, NUNCA pro browser)
// =================================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Falha alto e cedo se faltar a key — não vaza pro runtime
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Supabase admin: faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local"
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // Server-side: nao precisa manter sessao
    autoRefreshToken: false,
    persistSession: false,
  },
});