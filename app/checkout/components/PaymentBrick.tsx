"use client";

import { memo, useEffect, useState } from "react";
import { Payment, initMercadoPago } from "@mercadopago/sdk-react";
import { AlertCircle } from "lucide-react";

// =================================================================
// PaymentBrick — Brick do MP isolado, sem re-renders do pai
// =================================================================
// O proprio Brick do MP tem skeleton de loading nativo.
// NAO precisamos de isLoading customizado (causaria paradoxo de
// render: o early return impediria o onReady de disparar).
//
// O que mantemos:
// - React.memo() pra isolar de re-renders do pai
// - internalError pra mostrar mensagem de erro se o Brick falhar
// - Props primitivas estaveis (preferenceId, amount)
// =================================================================

// Inicializa SDK uma unica vez no module load
let sdkInitialized = false;
function ensureSdkInit() {
  if (!sdkInitialized) {
    initMercadoPago(
      process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "",
      { locale: "pt-BR" }
    );
    sdkInitialized = true;
  }
}

type PaymentBrickProps = {
  /** ID da preference criada no backend */
  preferenceId: string;
  /** Valor em reais (ex: 49.00) */
  amount: number;
};

function PaymentBrickBase({ preferenceId, amount }: PaymentBrickProps) {
  // Apenas estado de ERRO. Loading e de conta do proprio Brick.
  const [internalError, setInternalError] = useState<string | null>(null);

  // Inicializa SDK so uma vez
  useEffect(() => {
    ensureSdkInit();
  }, []);

  // Se der erro, mostra mensagem (substitui o Brick)
  if (internalError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong>Erro ao carregar pagamento:</strong> {internalError}
        </div>
      </div>
    );
  }

  // Renderiza o Brick DIRETAMENTE. O SDK mostra o skeleton
  // de loading dele mesmo (sem a gente precisar de state)
  return (
    <Payment
      initialization={{ amount, preferenceId }}
      customization={
        {
          // Chaves VALIDAS do Payment Brick (MP SDK v1.0.7):
          // - creditCard: cartao de credito
          // - debitCard: cartao de debito
          // - ticket: boleto
          // - bankTransfer: transferencia bancaria
          //
          // IMPORTANTE: "pix" NAO eh uma chave valida do `paymentMethods`
          // do Payment Brick (era ignorada em runtime). PIX eh renderizado
          // AUTOMATICAMENTE pelo Brick se a conta MP tiver PIX habilitado.
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
            ticket: "all",
            bankTransfer: "all",
          },
        } as any
      }
      onSubmit={async () => {
        // O Brick cuida do submit pro MP. Retornamos success pra fechar o fluxo.
        return { status: "success" } as any;
      }}
      onReady={() => {
        // So loga. NAO chamar setState aqui (causaria re-render)
        console.log("[PaymentBrick] iframe pronto");
      }}
      onError={(err: any) => {
        console.error("[PaymentBrick] erro:", err);
        const msg =
          typeof err === "string"
            ? err
            : err?.message || "Erro ao carregar o formulario de pagamento";
        setInternalError(msg);
      }}
    />
  );
}

// ============================================================
// React.memo com comparador customizado
// So re-renderiza se preferenceId OU amount mudarem
// ============================================================
export const PaymentBrick = memo(
  PaymentBrickBase,
  (prevProps, nextProps) => {
    return (
      prevProps.preferenceId === nextProps.preferenceId &&
      prevProps.amount === nextProps.amount
    );
  }
);