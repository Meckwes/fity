"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header simples */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-green-700 transition"
          >
            <ArrowLeft size={14} /> Voltar pro site
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Shield size={14} className="text-green-600" />
            Última atualização: 18 de julho de 2026
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        {/* Título */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
            <Shield size={12} />
            Termos legais
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Termos de Uso
          </h1>
          <p className="text-slate-600">
            Ao usar o <strong className="text-slate-900">Fity AI</strong>, você
            concorda com os termos abaixo. Leia com atenção.
          </p>
        </header>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <Section title="1. O que é o Fity AI">
            <p>
              O Fity AI é uma plataforma de{" "}
              <strong>assistente pessoal de saúde e fitness</strong> que opera
              exclusivamente via <strong>WhatsApp</strong>. Usamos inteligência
              artificial para gerar planos alimentares, treinos físicos e listas
              de compras personalizadas, enviados automaticamente todo dia às 7h
              da manhã no seu WhatsApp.
            </p>
            <p>
              O serviço é uma <strong>assinatura mensal</strong> com 7 dias
              grátis de teste, sem necessidade de cartão de crédito para começar.
            </p>
          </Section>

          <Section title="2. O que você recebe">
            <ul className="list-disc pl-6 space-y-2">
              <li>Briefing diário personalizado às 7h no WhatsApp</li>
              <li>Plano alimentar adaptado aos seus objetivos e restrições</li>
              <li>Treino físico ajustado ao seu equipamento e rotina</li>
              <li>Lista de compras semanal (enviada aos sábados)</li>
              <li>Adaptações baseadas no seu feedback e progresso</li>
              <li>Painel web com histórico de peso e métricas</li>
            </ul>
          </Section>

          <Section title="3. Pagamento e Cobrança">
            <p>
              Os pagamentos são processados <strong>100% pelo Mercado Pago</strong>,
              líder de pagamentos na América Latina. O Fity AI{" "}
              <strong>não armazena nenhum dado de cartão de crédito</strong> — as
              informações sensíveis (número, validade, CVV) são tokenizadas
              diretamente pelo Mercado Pago, seguindo o padrão PCI-DSS.
            </p>
            <p>Formas de pagamento aceitas:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>PIX (5% de desconto, aprovação instantânea)</li>
              <li>Cartão de crédito (em até 12x sem juros)</li>
              <li>Cartão de débito</li>
              <li>Boleto bancário</li>
            </ul>
          </Section>

          <Section title="4. Cancelamento">
            <p>
              Você pode <strong>cancelar a assinatura a qualquer momento</strong>,
              sem multa, sem burocracia, sem precisar ligar para central de
              atendimento. Basta clicar no botão &quot;Cancelar&quot; dentro do
              seu painel.
            </p>
            <p>
              O cancelamento é <strong>imediato</strong> e você continua com
              acesso ao serviço até o fim do ciclo já pago. Sem renovação
              automática após o cancelamento.
            </p>
          </Section>

          <Section title="5. Seus Dados e Privacidade">
            <p>
              Os dados que você compartilha (objetivos, peso, rotina, restrições
              alimentares, equipamentos) são usados{" "}
              <strong>exclusivamente para gerar seus planos personalizados via
              IA</strong>. Nunca vendemos, alugamos ou compartilhamos seus dados
              pessoais com terceiros para fins de marketing.
            </p>
            <p>
              Para detalhes completos sobre coleta, armazenamento e direitos do
              titular, consulte nossa{" "}
              <Link
                href="/privacidade"
                className="text-green-700 hover:text-green-800 underline underline-offset-4 font-semibold"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </Section>

          <Section title="6. Limitações do Serviço">
            <p>
              O Fity AI é um <strong>assistente de bem-estar</strong>, não
              substitui acompanhamento médico, nutricional ou de educação física
              profissional. As recomendações geradas são baseadas em inteligência
              artificial e podem não ser adequadas para condições médicas
              específicas.
            </p>
            <p>
              <strong>Consulte sempre um médico</strong> antes de iniciar qualquer
              dieta ou programa de exercícios, especialmente se você tiver
              condições pré-existentes de saúde.
            </p>
          </Section>

          <Section title="7. Limitação de Responsabilidade">
            <p>
              O Fity AI não se responsabiliza por lesões, problemas de saúde ou
              danos decorrentes do uso das recomendações sem supervisão
              profissional adequada. A responsabilidade pela execução dos planos
              e seus resultados é exclusivamente do usuário.
            </p>
          </Section>

          <Section title="8. Alterações nos Termos">
            <p>
              Podemos atualizar estes Termos periodicamente. Avisaremos sobre
              mudanças significativas por e-mail e/ou WhatsApp. O uso contínuo
              do serviço após as alterações constitui aceitação dos novos
              termos.
            </p>
          </Section>

          <Section title="9. Foro">
            <p>
              Estes Termos são regidos pelas leis da República Federativa do
              Brasil. Fica eleito o foro da Comarca de Fortaleza/CE para dirimir
              quaisquer conflitos.
            </p>
          </Section>

          <Section title="10. Contato">
            <p>
              Dúvidas sobre estes Termos? Fala com a gente:
            </p>
            <ul className="list-none space-y-1.5">
              <li>
                <strong>E-mail:</strong>{" "}
                <a
                  href="mailto:contato@fityai.com.br"
                  className="text-green-700 hover:text-green-800 underline underline-offset-4"
                >
                  contato@fityai.com.br
                </a>
              </li>
              <li>
                <strong>WhatsApp:</strong> Suporte direto via app
              </li>
            </ul>
          </Section>
        </div>

        {/* Voltar */}
        <div className="mt-16 pt-8 border-t border-slate-200 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-green-700 transition"
          >
            <ArrowLeft size={14} /> Voltar pra página inicial
          </Link>
        </div>
      </article>
    </main>
  );
}

// Componente de secao reusavel
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3 tracking-tight">
        {title}
      </h2>
      <div className="space-y-3 [&_a]:text-green-700 [&_a]:underline [&_a]:underline-offset-4 [&_strong]:text-slate-900 [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  );
}
