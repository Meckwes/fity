import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Fity — Receitas Fit + Treino no seu WhatsApp, todo dia",
  description:
    "Todo dia 7h no seu WhatsApp: o que comer em cada refeição, o que treinar, e a lista de compras da semana. Personalizado pra você, em português. Por R$29/mês.",
  keywords: [
    "receitas fit",
    "treino personalizado",
    "whatsapp",
    "emagrecer",
    "dieta",
    "fitness brasil",
  ],
  openGraph: {
    title: "Fity — Receitas Fit + Treino no seu WhatsApp",
    description:
      "Acabou a indecisão. Todo dia 7h, no seu Zap: o que comer, o que treinar, e a lista de compras.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
