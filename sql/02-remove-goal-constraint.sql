-- ============================================================
-- FITY — REMOVE A CONSTRAINT RIGIDA DO GOAL
-- Roda isso UMA VEZ no SQL Editor do Supabase
-- Efeito: a coluna "goal" passa a aceitar qualquer texto
--         (ou NULL, já que o campo é opcional)
--         sem o banco reclamar de valor fora da lista
-- ============================================================

-- 1. Remove a constraint antiga que limitava os valores
alter table public.leads
  drop constraint if exists leads_goal_check;

-- 2. (Opcional) Garante que a coluna aceita NULL e qualquer texto
--    Nao precisa criar CHECK — sem constraint = sem restricao
--    NULL continua permitido porque a coluna nao tem NOT NULL

-- 3. Confirmacao: mostra as constraints que SOBRARAM na tabela
select
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.leads'::regclass
order by conname;