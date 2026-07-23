-- =================================================================
-- FITY — Adiciona coluna food_preferences (preferencias alimentares)
-- =================================================================
-- Roda esse SQL no Supabase SQL Editor pra adicionar a coluna.
--
-- Estrutura JSONB:
--   {
--     "likes":    ["frango", "ovo", "tapioca", "banana"],
--     "dislikes": ["peixe", "figado", "beterraba"]
--   }
--
-- Usado pelo:
--   - Onboarding (lib/ai.ts): etapa 'food_preferences' coleta isso
--   - Briefing diario (generateBriefing): Gemini usa pra personalizar
--     os alimentos sugeridos em cada refeicao
--   - Feedback loop (lib/profile-store.ts): preferencias podem crescer
--     ao longo do tempo quando user mencionar coisas novas
-- =================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS food_preferences JSONB DEFAULT NULL;

-- Comentario pra documentar a estrutura esperada
COMMENT ON COLUMN profiles.food_preferences IS
  'Preferencias alimentares do user. Formato: { likes: string[], dislikes: string[] }. NULL = sem preferencia coletada ainda.';
