import { NextResponse } from "next/server";
import { generateBriefing, type UserProfile } from "@/lib/ai";

// =================================================================
// FITY — ROTA DE TESTE: AI CEREBRO
// =================================================================
// Como testar:
// 1. Sobe o dev server: npm run dev
// 2. Abre http://localhost:3000/api/ai/test no navegador
// 3. Ve o JSON gerado pelo Gemini, formatado bonitinho
// =================================================================

// ============================================================
// 👇 EDITE O PERFIL FALSO AQUI PRA TESTAR DIFERENTES CENARIOS
// ============================================================
const FAKE_PROFILE: UserProfile = {
  name: "Jessica",
  goal: "emagrecer",
  weight_kg: 80,
  height_cm: 165,
  age: 34,
  sex: "F",
  activity_level: "leve",
  equipment: ["academia completa"],
  dietary_restrictions: [],
  meals_per_day: 4,
  workout_days_per_week: 3,
  workout_time: "almoco",
};

// Outros perfis pra voce testar (descomente um e comente o de cima):

// const FAKE_PROFILE: UserProfile = {
//   name: "Marcos",
//   goal: "ganhar-massa",
//   weight_kg: 72,
//   height_cm: 178,
//   age: 28,
//   sex: "M",
//   activity_level: "moderado",
//   equipment: ["academia completa", "halteres"],
//   dietary_restrictions: [],
//   meals_per_day: 5,
//   workout_days_per_week: 5,
//   workout_time: "tarde",
// };

// const FAKE_PROFILE: UserProfile = {
//   name: "Dona Helena",
//   goal: "saude",
//   weight_kg: 68,
//   height_cm: 160,
//   age: 52,
//   sex: "F",
//   activity_level: "sedentario",
//   equipment: ["peso corporal", "elastico"],
//   dietary_restrictions: ["sem lactose"],
//   meals_per_day: 4,
//   workout_days_per_week: 3,
//   workout_time: "manha",
// };

// ============================================================

export async function GET() {
  const startedAt = Date.now();
  const result = await generateBriefing(FAKE_PROFILE);
  const totalDuration = Date.now() - startedAt;

  if (!result.ok) {
    const errorBody = JSON.stringify(
      {
        ok: false,
        profile_enviado: FAKE_PROFILE,
        error: result.error,
        raw_recebido: result.raw,
        gemini_duration_ms: result.duration_ms,
        total_duration_ms: totalDuration,
      },
      null,
      2
    );

    return new NextResponse(errorBody, {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const successBody = JSON.stringify(
    {
      ok: true,
      model: "gemini-1.5-flash",
      profile_enviado: FAKE_PROFILE,
      briefing_gerado: result.briefing,
      gemini_duration_ms: result.duration_ms,
      total_duration_ms: totalDuration,
    },
    null,
    2
  );

  return new NextResponse(successBody, {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}