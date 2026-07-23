// =================================================================
// FITY — Keepalive (evita cold start do Vercel)
// =================================================================
// Pinga a cada 5 min pra manter a funcao "quente" no Vercel hobby.
// Sem isso, o webhook demora 3-5s a mais pra bootar (cold start),
// o que combinado com o trabalho de processamento (Gemini + Supabase)
// estoura o timeout de 10s do Vercel e mata a request antes de
// conseguir chamar o /send do bot.
// =================================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
