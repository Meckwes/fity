// scripts/check-users-schema.mjs
// Verifica schema da tabela users (colunas, indices)
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Pega 1 user pra ver as colunas
const { data, error } = await supabase
  .from('users')
  .select('*')
  .limit(1);

if (error) {
  console.error('ERRO:', error);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log('Tabela vazia. Vou criar um user fake pra inspecionar schema.');
  process.exit(0);
}

const cols = Object.keys(data[0]).sort();
console.log('Colunas da tabela users:');
for (const c of cols) {
  const v = data[0][c];
  const t = v === null ? 'null' : typeof v;
  console.log(`  ${c} (${t})`);
}
