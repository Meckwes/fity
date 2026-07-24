// scripts/check-subscriptions.mjs
// Verifica usuários com subscription Stripe ativa (pra debug)
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

const { data, error } = await supabase
  .from('users')
  .select('id, name, phone, subscription_status, subscription_plan, stripe_customer_id, subscription_current_period_end, updated_at')
  .not('subscription_status', 'is', null)
  .order('updated_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('ERRO:', error);
  process.exit(1);
}

if (data.length === 0) {
  console.log('Nenhum usuário com subscription_status preenchido ainda.');
  console.log('(Pode ser que o webhook nao chegou, ou chegou sem userId no metadata)');
} else {
  console.log(`${data.length} usuário(s) com subscription:\n`);
  for (const u of data) {
    console.log(`- ${u.name || '(sem nome)'}`);
    console.log(`  id:                ${u.id}`);
    console.log(`  subscription:      ${u.subscription_status} (${u.subscription_plan || '?'})`);
    console.log(`  stripe_customer:   ${u.stripe_customer_id || '(vazio)'}`);
    console.log(`  period_end:        ${u.subscription_current_period_end || '(vazio)'}`);
    console.log(`  updated_at:        ${u.updated_at}`);
    console.log('');
  }
}
