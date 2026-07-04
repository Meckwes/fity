import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    // 1. Lê e valida o body
    const body = await req.json();
    const { name, email, whatsapp, goal } = body;

    if (!name || !email || !whatsapp) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando" },
        { status: 400 }
      );
    }

    // 2. Insere no Supabase (sem .select() — não precisamos retornar nada ao cliente)
    //    Isso evita exigir permissão de SELECT no role anon.
    const { error } = await supabase
      .from("leads")
      .insert([{ name, email, whatsapp, goal: goal || null }]);

    // 3. Trata erros
    if (error) {
      console.error("Supabase error:", error);

      // Erro de permissão (RLS bloqueando)
      if (error.code === "42501" || /permission denied/i.test(error.message)) {
        return NextResponse.json(
          {
            error:
              "Permissão negada no banco. Rode o SQL de grants no Supabase (anon precisa de INSERT).",
            code: error.code,
            hint: "Veja o bloco 'CORREÇÃO DE PERMISSÕES' no SQL da tabela leads.",
          },
          { status: 500 }
        );
      }

      // Erro de constraint (ex: email duplicado)
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "Você já se cadastrou antes. Te mandamos mensagem no Zap! 😉",
            code: error.code,
          },
          { status: 409 }
        );
      }

      // Erro de validação (ex: email inválido, whatsapp curto)
      if (error.code === "23514") {
        return NextResponse.json(
          {
            error:
              "Confira os campos: email válido, WhatsApp com DDD (10-13 dígitos).",
            code: error.code,
          },
          { status: 400 }
        );
      }

      // Qualquer outro erro do banco
      return NextResponse.json(
        { error: "Erro ao salvar no banco", code: error.code },
        { status: 500 }
      );
    }

    // 4. Sucesso
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Erro inesperado (parse do JSON, etc)
    console.error("Lead POST error:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar a requisição" },
      { status: 500 }
    );
  }
}