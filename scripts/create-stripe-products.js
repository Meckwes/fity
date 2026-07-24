// scripts/create-stripe-products.js
// Cria os 3 produtos do Fity AI no Stripe (modo teste)
// Roda uma vez: `node scripts/create-stripe-products.js`

const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

const plans = [
  { name: 'Fity AI — Essencial', description: 'Briefing diário com treino e alimentação personalizados.', amount: 2900 },
  { name: 'Fity AI — Pro', description: 'Tudo do Essencial + análise de foto de refeição por IA + adaptação por feedback.', amount: 4900 },
  { name: 'Fity AI — Coach', description: 'Tudo do Pro + suporte prioritário + ajustes ilimitados.', amount: 7900 },
];

async function main() {
  console.log('Criando 3 produtos no Stripe (modo teste)...\n');
  const results = [];
  for (const plan of plans) {
    try {
      // 1. Cria o produto
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
      });
      // 2. Cria o pre\u00e7o recorrente (mensal, BRL, com trial 7 dias)
      const price = await stripe.prices.create({
        product: product.id,
        currency: 'brl',
        unit_amount: plan.amount,
        recurring: {
          interval: 'month',
          trial_period_days: 7,
        },
      });
      results.push({ plan: plan.name, product_id: product.id, price_id: price.id, amount: plan.amount / 100 });
      console.log(`OK  ${plan.name}`);
      console.log(`    product_id: ${product.id}`);
      console.log(`    price_id:   ${price.id}`);
      console.log(`    R$ ${(plan.amount / 100).toFixed(2)}/m\u00eas + 7 dias gr\u00e1tis\n`);
    } catch (err) {
      console.error(`ERRO em ${plan.name}: ${err.message}`);
    }
  }
  console.log('=== Resumo ===');
  console.log(JSON.stringify(results, null, 2));
  console.log('\nPr\u00f3ximo: adiciona os price_id no .env.local:');
  for (const r of results) {
    const key = r.plan.match(/Essencial|Pro|Coach/)[0].toUpperCase().replace('PRO', 'PRO');
    console.log(`STRIPE_PRICE_${key}=${r.price_id}`);
  }
}

main().catch(console.error);
