-- =================================================================
-- FITY — Tabela `trials` (trial de 7 dias com captura automatica)
-- =================================================================
-- Rodar no Supabase SQL Editor antes de usar o trial.
--
-- Fluxo:
--   1. User faz checkout trial (capture=false no MP)
--   2. API salva nessa tabela com status='active' e charge_date = hoje+7
--   3. Cron diario /api/cron/process-trials roda 1x/dia:
--      - 1 dia antes da charge_date: manda WhatsApp aviso
--      - na charge_date: captura a payment no MP
--   4. Se user cancelar antes: status='cancelled' e a captura e pulada
-- =================================================================

CREATE TABLE IF NOT EXISTS trials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      bigint NOT NULL UNIQUE,  -- ID da payment no MP (capture=false)
  customer_name   text NOT NULL,
  customer_email  text NOT NULL,
  customer_phone  text,                    -- com DDD, formato 5511999999999
  customer_cpf    text,
  plan_id         text NOT NULL,
  plan_name       text NOT NULL,
  amount          numeric(10,2) NOT NULL,
  start_date      timestamptz NOT NULL DEFAULT now(),
  charge_date     timestamptz NOT NULL,    -- quando vai capturar de verdade
  reminder_date   timestamptz NOT NULL,    -- 1 dia antes (whatsapp aviso)
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'captured', 'cancelled', 'failed')),
  notified_day6   boolean NOT NULL DEFAULT false,
  captured_at     timestamptz,
  cancelled_at    timestamptz,
  failure_reason  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indices pra o cron achar os trials do dia rapido
CREATE INDEX IF NOT EXISTS trials_status_charge_date_idx
  ON trials (status, charge_date);

CREATE INDEX IF NOT EXISTS trials_status_reminder_date_idx
  ON trials (status, reminder_date);

CREATE INDEX IF NOT EXISTS trials_customer_email_idx
  ON trials (customer_email);

-- Trigger pra manter updated_at atualizado
CREATE OR REPLACE FUNCTION trials_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trials_updated_at ON trials;
CREATE TRIGGER trials_updated_at
  BEFORE UPDATE ON trials
  FOR EACH ROW
  EXECUTE FUNCTION trials_set_updated_at();

-- Permissoes (anon NAO tem acesso, so service_role via API)
ALTER TABLE trials ENABLE ROW LEVEL SECURITY;

-- Politica: service_role (usado pela API) tem acesso total
DROP POLICY IF EXISTS "service_role_full_access" ON trials;
CREATE POLICY "service_role_full_access" ON trials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
