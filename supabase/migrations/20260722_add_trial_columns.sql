-- =================================================================
-- FITY — Adiciona colunas pra controlar o trial freemium
-- =================================================================
-- Roda esse SQL no Supabase SQL Editor pra adicionar as colunas:
--   1. trial_started_at: quando o user mandou a PRIMEIRA msg no Zap
--   2. trial_ended_notified: se ja mandamos o aviso de "trial acabou"
--
-- O cron /api/cron/check-trial-ended usa essas colunas pra:
--   - Achar trials com 7+ dias
--   - Mandar msg avisando + link de pagamento
--   - Marcar como notificado (idempotente)
-- =================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ended_notified BOOLEAN DEFAULT FALSE;

-- Index pra achar trials expirados rapido
CREATE INDEX IF NOT EXISTS idx_users_trial_check
  ON users (trial_started_at, trial_ended_notified)
  WHERE trial_started_at IS NOT NULL;
