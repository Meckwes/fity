-- =================================================================
-- FITY — Migration: adiciona expires_at + status 'paused'/'expired'
-- =================================================================
-- Rodar no Supabase SQL Editor.
--
-- Mudancas:
--   1. Coluna expires_at: data de expiracao do ciclo de 30 dias pago.
--   2. Coluna renewal_reminder_sent: idempotencia do aviso de renovacao.
--   3. Coluna paused_at: timestamp de quando foi pausado.
--   4. Status enum: adiciona 'paused' e 'expired'.
--   5. Indices pra o cron de check-expirations ser rapido.
-- =================================================================

-- 1) Coluna expires_at (data em que expira o ciclo de 30 dias)
ALTER TABLE trials
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2) Flag de idempotencia do aviso de renovacao (evita mandar 2x)
ALTER TABLE trials
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent boolean NOT NULL DEFAULT false;

-- 3) Timestamp de quando foi pausado
ALTER TABLE trials
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- 4) Atualiza o CHECK constraint do status pra incluir 'paused' e 'expired'
ALTER TABLE trials DROP CONSTRAINT IF EXISTS trials_status_check;
ALTER TABLE trials
  ADD CONSTRAINT trials_status_check
  CHECK (status IN ('active', 'captured', 'cancelled', 'failed', 'paused', 'expired'));

-- 5) Indice composto pro cron de expiracao (filtra por status + data)
CREATE INDEX IF NOT EXISTS trials_status_expires_at_idx
  ON trials (status, expires_at)
  WHERE status IN ('captured', 'paused');

-- 6) Backfill: pra trials ja capturados sem expires_at, define como
-- captured_at + 30 dias (ou created_at + 37 se nao tem captured_at).
-- Isso evita perder o controle de quem ja ta no plano.
UPDATE trials
SET expires_at = COALESCE(
  captured_at + INTERVAL '30 days',
  created_at + INTERVAL '37 days'
)
WHERE status = 'captured' AND expires_at IS NULL;
