-- 20260724_add_stripe_columns.sql
-- Adiciona colunas pra tracking de assinatura Stripe nos users
-- Idempotente (IF NOT EXISTS)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,  -- 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,    -- 'essencial' | 'pro' | 'coach'
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

-- Index pra busca rapida por customer_id (webhook)
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Index pra buscar users ativos
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
