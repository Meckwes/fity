-- =================================================================
-- FITY — Remove NOT NULL constraint da coluna phone em users
-- =================================================================
-- Por que: o user-store.ts (commit 73d38aa) agora retorna phone=null
-- quando o LID nao tem formato BR (12-13 digitos, prefixo 55).
-- Mas a coluna phone tem NOT NULL, entao o INSERT quebra.
--
-- A coluna phone eh AUXILIAR — o identificador real eh o LID.
--   - Users que vem so do Zap (sem checkout) -> phone pode ser null
--   - Users que pagam -> phone real fica em trials.customer_phone
--   - Briefing usa LID, nao phone, pra enviar mensagem
--
-- Regression introduzida no commit 73d38aa, corrigida aqui.
-- =================================================================

ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
