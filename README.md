<div align="center">

# 🥗 Fity — Receitas Fit + Treino no seu WhatsApp

> Acabou a indecisão. Todo dia 7h no seu Zap: o que comer, o que treinar, e a lista de compras.

**SaaS brasileiro que entrega briefing diário personalizado de alimentação + treino via WhatsApp.**
Diferente de apps de fitness que viram biblioteca gigante, o Fity **decide por você** todo dia.

[Demo](https://fity-app.vercel.app) · [Roadmap](#-roadmap) · [Stack](#-stack) · [Setup](#-como-rodar)

</div>

---

## 💡 O que é o Fity

O Fity ataca um mercado enorme (apps fitness + nutrição no Brasil = **R$ 8,2 bi em 2026**) com um ângulo novo: **não é mais uma biblioteca de conteúdo, é um assistente que decide por você todo dia**.

| Concorrentes (Queima Diária, Dietto) | Fity |
|---------------------------------------|------|
| "Tem 5 mil receitas, boa sorte navegando" | "Hoje é descanso ativo, come mais proteína" |
| App nativo que você esquece no celular | Briefing diário às 7h no WhatsApp |
| Dieta americana genérica | Arroz, feijão, tapioca, açaí — comida brasileira de verdade |
| R$ 19-49/mês de conteúdo estático | R$ 29/mês de decisão diária personalizada por IA |

**Fase atual: Landing page de validação** — captura leads antes de construir o bot WhatsApp real.
**Próxima fase:** Onboarding conversacional + briefing diário gerado por Claude.

---

## 🛠️ Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** com tokens customizados da marca
- **Supabase** (Postgres + RLS) para captura de leads
- **shadcn-style components** (custom, sem dependência externa)
- **lucide-react** para ícones

**Decisões de arquitetura:**
- WhatsApp-first (não app nativo) → entra no canal que o brasileiro já vive
- Sem login pra visitor → captura anônima com RLS bloqueando SELECT/DELETE
- Build estático quando possível → 96 KB First Load JS

---

## 🚀 Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edita .env.local com suas chaves do Supabase e número de WhatsApp

# 3. Subir dev server
npm run dev
```

Abre em **http://localhost:3000**

Para deploy em produção: ver seção [Deploy](#-deploy) abaixo.

---

## 📁 Estrutura

```
fity-app/
├── app/
│   ├── api/lead/route.ts   # POST endpoint → Supabase
│   ├── globals.css          # Tailwind + estilos custom
│   ├── layout.tsx           # Metadata SEO + fonte Inter
│   └── page.tsx             # Home (monta todas as seções)
├── components/
│   ├── ui/button.tsx
│   ├── Hero.tsx             # Hero + mockup do Zap
│   ├── Problem.tsx          # 3 cards de dor
│   ├── HowItWorks.tsx       # 3 passos visuais
│   ├── SampleBriefing.tsx   # Briefing + lista de compras
│   ├── Pricing.tsx          # 3 planos (R$29/49/79)
│   ├── FAQ.tsx              # 6 perguntas em accordion
│   ├── LeadForm.tsx         # Formulário → Supabase
│   └── Footer.tsx
├── lib/
│   ├── supabase.ts          # Cliente Supabase + tipos
│   └── utils.ts             # cn() helper
├── sql/
│   └── 99-limpar-dados-teste.sql
├── .env.example
├── tailwind.config.ts       # Cores da marca Fity
└── README.md
```

---

## 🗺️ Roadmap

- [x] **Fase 0** — Landing page mobile-first com captura de leads
- [x] **Fase 0.5** — RLS no Supabase + validação de dados
- [ ] **Fase 1** — Bot WhatsApp (onboarding + briefing diário com Claude)
- [ ] **Fase 2** — Painel admin para visualização de leads
- [ ] **Fase 3** — Integração Asaas (PIX + cartão recorrente)
- [ ] **Fase 4** — Adaptação semanal automática do plano
- [ ] **Fase 5** — Comunidade no Telegram por objetivo

---

## 🌐 Deploy

**Vercel** (recomendado, gratuito):

1. Subir código pro GitHub
2. Importar projeto em [vercel.com/new](https://vercel.com/new)
3. Adicionar as env vars do `.env.local`
4. Deploy

Build atual: **96 KB First Load JS** · 5 páginas estáticas · API route dinâmica para `/api/lead`.

---

## 📜 Licença

MIT — pode usar como base pro seu próprio SaaS fitness.

---

<div align="center">

Feito com 💚 no Brasil · 2026

</div>

---

## 🚀 Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edita .env.local com suas chaves do Supabase (veja abaixo)

# 3. Subir o dev server
npm run dev
```

Abre em **http://localhost:3000**

---

## 🔑 Configurando o Supabase (opcional — só pro formulário)

O site funciona **sem Supabase configurado** — só o formulário de captação fica inativo. Quando quiser ligar:

1. Cria projeto em https://supabase.com
2. Vai em SQL Editor e roda:
   ```sql
   create table public.leads (
     id uuid default uuid_generate_v4() primary key,
     name text not null,
     email text not null,
     whatsapp text not null,
     goal text,
     created_at timestamp with time zone default now()
   );

   -- Liga Row Level Security mas permite insert anon
   alter table public.leads enable row level security;
   create policy "Allow anon inserts" on public.leads
     for insert with check (true);
   ```
3. Pega a **URL** e a **anon key** em Project Settings → API
4. Cola no `.env.local`

---

## 📱 Configurando o WhatsApp

Edita no `.env.local`:

```
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999  # seu número com DDI+DDD, sem espaços
NEXT_PUBLIC_WHATSAPP_MESSAGE=Sua mensagem padrão aqui
```

Todos os botões CTA da página abrem o WhatsApp com esse número.

---

## 🌐 Como fazer deploy (Vercel — de graça)

1. Sobe o código pro GitHub
2. Vai em https://vercel.com/new
3. Importa o repo
4. Adiciona as env vars (as mesmas do `.env.local`)
5. Click Deploy
6. Em ~2 minutos tá no ar com URL pública

Pra domínio custom (`fity.com.br`), compra em Registro.br e configura depois.

---

## 📁 Estrutura

```
fity-app/
├── app/
│   ├── api/lead/route.ts   # POST endpoint pro formulário
│   ├── globals.css          # estilos globais + tailwind
│   ├── layout.tsx           # layout raiz + metadata
│   └── page.tsx             # home (monta todas as seções)
├── components/
│   ├── ui/button.tsx        # botão reutilizável
│   ├── Hero.tsx             # hero + mockup do Zap
│   ├── Problem.tsx          # 3 cards de dor
│   ├── HowItWorks.tsx       # 3 passos
│   ├── SampleBriefing.tsx   # briefing + lista de compras
│   ├── Pricing.tsx          # 3 planos
│   ├── FAQ.tsx              # accordion
│   ├── LeadForm.tsx         # captura de lead
│   └── Footer.tsx
├── lib/
│   ├── supabase.ts          # cliente Supabase
│   └── utils.ts             # cn() helper
├── .env.example
├── next.config.mjs
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🎯 O que está incluído

- ✅ Hero responsiva com mockup do WhatsApp (mobile-first)
- ✅ 3 cards de problema
- ✅ 3 passos de como funciona
- ✅ Briefing + lista de compras visualizados
- ✅ Pricing com 3 planos + destaque do Pro
- ✅ FAQ accordion
- ✅ Formulário de captação salvando no Supabase
- ✅ Footer com links
- ✅ Mobile-perfect (testado em todos os breakpoints)

---

## 🎨 Customizando a marca

Cores ficam no `tailwind.config.ts`. Padrão Fity:

- Verde primário: `green-600` (#059669)
- Laranja accent: `orange-500` (#f59e0b)
- Ink (texto): `ink-900` (#0f172a)

Pra mudar, edita os tokens em `tailwind.config.ts` e pronto.

---

## ⏭️ Próximas fases (depois da landing)

1. **Bot WhatsApp real** (Z-API ou Meta Cloud) — onboarding + briefing diário
2. **Painel web** (login, dashboard, histórico)
3. **Integração Asaas** (PIX + cartão recorrente)

---

Feito por Wesley · 2026
