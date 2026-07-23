"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, FileText } from "lucide-react";

export default function PrivacidadePage() {
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
            <Lock size={14} className="text-green-600" />
            Última atualização: 18 de julho de 2026
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        {/* Título */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
            <ShieldCheck size={12} />
            LGPD · Lei Geral de Proteção de Dados
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Política de Privacidade
          </h1>
          <p className="text-slate-600">
            Como o <strong className="text-slate-900">Fity AI</strong> coleta,
            usa, armazena e protege seus dados pessoais — em conformidade com a{" "}
            <strong>LGPD (Lei nº 13.709/2018)</strong>.
          </p>
        </header>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <Section title="1. Quem somos (Controlador)">
            <p>
              <strong>Otimize Tecnologia</strong>, pessoa jurídica de direito
              privado, com sede em <strong>Fortaleza/CE</strong>, é a{" "}
              <strong>controladora</strong> dos seus dados pessoais coletados
              através do Fity AI.
            </p>
            <p>
              Para qualquer dúvida sobre esta Política ou sobre o tratamento dos
              seus dados, entre em contato com nosso{" "}
              <strong>Encarregado de Proteção de Dados (DPO)</strong> pelo e-mail{" "}
              <a
                href="mailto:dpo@fityai.com.br"
                className="text-green-700 hover:text-green-800 underline underline-offset-4"
              >
                dpo@fityai.com.br
              </a>
              .
            </p>
          </Section>

          <Section title="2. Quais dados coletamos">
            <p>
              Para fornecer o serviço de assistente de saúde e fitness via
              WhatsApp, coletamos as seguintes categorias de dados:
            </p>

            <h3 className="text-base font-bold text-slate-900 mt-3">
              2.1. Dados fornecidos por você
            </h3>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Dados de cadastro:</strong> nome, e-mail, número de
                WhatsApp, CPF
              </li>
              <li>
                <strong>Dados de saúde e fitness:</strong> peso, altura, idade,
                objetivos (emagrecer, ganhar massa, performance), rotina de
                exercícios, restrições alimentares, lesões ou limitações físicas
              </li>
              <li>
                <strong>Feedbacks e preferências:</strong> respostas ao briefing,
                substituições de alimentos solicitadas, adaptações de treino
              </li>
            </ul>

            <h3 className="text-base font-bold text-slate-900 mt-3">
              2.2. Dados coletados automaticamente
            </h3>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Dados de uso:</strong> horários de interação com o bot,
                planos gerados, histórico de conversas
              </li>
              <li>
                <strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo,
                logs de acesso (apenas para segurança e prevenção de fraudes)
              </li>
            </ul>

            <h3 className="text-base font-bold text-slate-900 mt-3">
              2.3. Dados de pagamento
            </h3>
            <p>
              <strong>Não armazenamos dados de cartão de crédito</strong> em
              nossos servidores. Todos os pagamentos são processados diretamente
              pelo <strong>Mercado Pago</strong>, que é um processador
              certificado PCI-DSS. O Mercado Pago nos envia apenas um token
              representando o método de pagamento, sem jamais expor dados
              sensíveis do cartão.
            </p>
          </Section>

          <Section title="3. Para que usamos seus dados (Finalidades)">
            <p>
              Os dados coletados são utilizados{" "}
              <strong>exclusivamente</strong> para:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Gerar planos personalizados</strong> de alimentação e
                treino físico usando inteligência artificial
              </li>
              <li>
                <strong>Enviar briefings diários</strong> via WhatsApp às 7h da
                manhã
              </li>
              <li>
                <strong>Adaptar as recomendações</strong> baseado no seu feedback
                e progresso
              </li>
              <li>
                <strong>Processar pagamentos</strong> e gerenciar sua assinatura
              </li>
              <li>
                <strong>Suporte ao cliente</strong> e resolução de problemas
              </li>
              <li>
                <strong>Prevenção de fraudes</strong> e segurança da plataforma
              </li>
              <li>
                <strong>Cumprimento de obrigações legais</strong> e fiscais
              </li>
            </ul>
            <p className="text-sm bg-amber-50 border border-amber-200 rounded-xl p-3">
              <strong>Não usamos seus dados para:</strong> vender para
              terceiros, fazer propaganda de outros produtos, treinar modelos de
              IA genéricos compartilhados com terceiros.
            </p>
          </Section>

          <Section title="4. Base legal (LGPD)">
            <p>O tratamento dos seus dados se baseia nas seguintes hipóteses da LGPD:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Execução de contrato</strong> (art. 7º, V): para
                prestar o serviço contratado
              </li>
              <li>
                <strong>Consentimento</strong> (art. 7º, I): para finalidades
                específicas que você aceita explicitamente (ex: comunicações de
                marketing)
              </li>
              <li>
                <strong>Legítimo interesse</strong> (art. 7º, IX): para
                prevenção de fraudes e segurança
              </li>
              <li>
                <strong>Cumprimento de obrigação legal</strong> (art. 7º, II):
                para fins fiscais e legais
              </li>
            </ul>
          </Section>

          <Section title="5. Compartilhamento de dados">
            <p>
              <strong>Nunca vendemos seus dados pessoais.</strong> Eventuais
              compartilhamentos ocorrem apenas com:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Mercado Pago</strong> — processador de pagamentos (dados
                de transação e billing)
              </li>
              <li>
                <strong>Meta / WhatsApp</strong> — plataforma onde a interação
                acontece
              </li>
              <li>
                <strong>Provedores de infraestrutura</strong> (Supabase, Vercel)
                que armazenam dados sob contrato de confidencialidade
              </li>
              <li>
                <strong>Autoridades legais</strong> quando exigido por lei ou
                ordem judicial
              </li>
            </ul>
          </Section>

          <Section title="6. Armazenamento e Segurança">
            <p>
              Seus dados são armazenados em servidores seguros (Supabase /
              Vercel), com criptografia em trânsito (HTTPS/TLS) e em repouso.
              Aplicamos medidas técnicas e organizacionais para proteger seus
              dados contra acesso não autorizado, perda ou destruição.
            </p>
            <p>
              <strong>Retenção:</strong> mantemos seus dados enquanto sua conta
              estiver ativa. Após o cancelamento, os dados são excluídos em até{" "}
              <strong>90 dias</strong>, exceto quando a lei exigir retenção por
              prazo maior (ex: obrigações fiscais de 5 anos).
            </p>
          </Section>

          <Section title="7. Seus direitos como titular">
            <p>
              Você tem os seguintes direitos garantidos pela LGPD (art. 18):
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>✅ Confirmar a existência de tratamento de dados</li>
              <li>✅ Acessar seus dados</li>
              <li>✅ Corrigir dados incompletos ou desatualizados</li>
              <li>✅ Solicitar anonimização, bloqueio ou eliminação</li>
              <li>✅ Solicitar portabilidade dos dados</li>
              <li>✅ Revogar consentimento a qualquer momento</li>
              <li>✅ Cancelar a assinatura e solicitar exclusão da conta</li>
            </ul>
            <p>
              Para exercer qualquer um desses direitos, envie um e-mail para{" "}
              <a
                href="mailto:dpo@fityai.com.br"
                className="text-green-700 hover:text-green-800 underline underline-offset-4 font-semibold"
              >
                dpo@fityai.com.br
              </a>{" "}
              ou use o comando <strong>&quot;excluir meus dados&quot;</strong>{" "}
              no nosso WhatsApp. Responderemos em até <strong>15 dias</strong>.
            </p>
          </Section>

          <Section title="8. Cookies e Tecnologias">
            <p>
              O site do Fity AI utiliza cookies essenciais para autenticação e
              funcionamento. Não utilizamos cookies de rastreamento publicitário
              de terceiros. No painel web, cookies técnicos armazenam suas
              preferências de sessão.
            </p>
          </Section>

          <Section title="9. Direitos de crianças e adolescentes">
            <p>
              O Fity AI <strong>não é direcionado a menores de 18 anos</strong>.
              Caso identifiquemos dados de menores coletados sem o consentimento
              dos responsáveis, removeremos imediatamente.
            </p>
          </Section>

          <Section title="10. Alterações nesta Política">
            <p>
              Esta Política pode ser atualizada periodicamente. Avisaremos sobre
              mudanças significativas por e-mail e/ou WhatsApp, com pelo menos{" "}
              <strong>30 dias de antecedência</strong>.
            </p>
          </Section>

          <Section title="11. Encarregado de Proteção de Dados (DPO)">
            <p>
              Para qualquer questão sobre privacidade e proteção de dados,
              entre em contato com nosso DPO:
            </p>
            <ul className="list-none space-y-1.5">
              <li>
                <strong>E-mail:</strong>{" "}
                <a
                  href="mailto:dpo@fityai.com.br"
                  className="text-green-700 hover:text-green-800 underline underline-offset-4"
                >
                  dpo@fityai.com.br
                </a>
              </li>
              <li>
                <strong>WhatsApp:</strong> via app, comando{" "}
                <em>&quot;falar com DPO&quot;</em>
              </li>
            </ul>
            <p className="text-sm text-slate-500 mt-3">
              Você também tem o direito de fazer uma reclamação diretamente à{" "}
              <strong>ANPD (Autoridade Nacional de Proteção de Dados)</strong>{" "}
              através do site{" "}
              <a
                href="https://www.gov.br/anpd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 hover:underline"
              >
                gov.br/anpd
              </a>
              .
            </p>
          </Section>
        </div>

        {/* Voltar + link Termos */}
        <div className="mt-16 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-green-700 transition"
          >
            <ArrowLeft size={14} /> Voltar pra página inicial
          </Link>
          <Link
            href="/termos"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-green-700 transition"
          >
            <FileText size={14} /> Ver Termos de Uso
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
      <div className="space-y-3 [&_a]:text-green-700 [&_a]:underline [&_a]:underline-offset-4 [&_strong]:text-slate-900 [&_strong]:font-semibold [&_h3]:mt-2">
        {children}
      </div>
    </section>
  );
}
