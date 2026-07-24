// scripts/fix-phone.mjs
// Atualiza o phone do user mais recente que tem subscription Stripe
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Pega o user mais recente com subscription
const { data: user, error } = await supabase
  .from('users')
  .select('id, name, phone')
  .not('subscription_status', 'is', null)
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (error || !user) {
  console.error('ERRO:', error || 'user nao encontrado');
  process.exit(1);
}

// Adiciona 55 se faltar
const phoneClean = (user.phone || '').replace(/\D/g, '');
const phoneFinal = phoneClean.startsWith('55') ? phoneClean : '55' + phoneClean;

const { error: upError } = await supabase
  .from('users')
  .update({ phone: phoneFinal })
  .eq('id', user.id);

if (upError) {
  console.error('Erro atualizando:', upError);
  process.exit(1);
}

console.log(`User ${user.name} (${user.id})`);
console.log(`Phone: ${user.phone} -> ${phoneFinal}`);
