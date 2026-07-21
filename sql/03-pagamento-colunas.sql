-- ============================================================
-- FITY — Adiciona colunas de pagamento na tabela users
-- Roda uma vez no SQL Editor do Supabase
-- ============================================================

-- Colunas para rastrear pagamento do Mercado Pago
alter table public.users
add column if not exists email text,
add column if not exists current_plan text,
add column if not exists subscription_status text default 'trial' check (subscription_status in ('trial', 'active', 'past_due', 'canceled', 'none')),
add column if not exists subscription_ends_at timestamptz,
add column if not exists last_payment_at timestamptz,
add column if not exists last_payment_amount numeric(10,2),
add column if not exists mp_payment_id text,
add column if not exists mp_payer_id text;

-- Indice pra buscar user por email (webhook usa pra encontrar/criar user)
create index if not exists users_email_idx
  on public.users (email)
  where email is not null;

-- Indice pra idempotencia do webhook (evita processar o mesmo pagamento 2x)
create index if not exists users_mp_payment_idx
  on public.users (mp_payment_id)
  where mp_payment_id is not null;

-- Confirma as colunas criadas
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name in ('email', 'current_plan', 'subscription_status', 'subscription_ends_at', 'last_payment_at', 'last_payment_amount', 'mp_payment_id', 'mp_payer_id')
order by column_name;