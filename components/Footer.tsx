"use client";
import Link from "next/link";
import { MessageCircle, Instagram, Mail } from "lucide-react";

// Links e contatos - todos via env vars (configura no .env.local)
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511999999999";
const INSTAGRAM = process.env.NEXT_PUBLIC_FITY_INSTAGRAM || "fity.ai";
const EMAIL = process.env.NEXT_PUBLIC_FITY_EMAIL || "contato@fityai.com.br";

const WA_DEFAULT_MSG = encodeURIComponent(
  "Olá! Vim pelo site do Fity AI e quero saber mais."
);
const WA_LINK = `https://wa.me/${WHATSAPP}?text=${WA_DEFAULT_MSG}`;

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink-900 text-white pt-16 pb-10">
      <div className="container-wide">
        <div className="grid sm:grid-cols-3 gap-10 mb-10">
          {/* Coluna 1: marca + tagline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img
                src="/fity-logo.png"
                alt="Fity AI"
                className="h-10 w-10"
              />
              <span className="font-extrabold text-xl">Fity AI</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Seu assistente diário de evolução: exercícios, refeições e
              compras organizados para você no WhatsApp.
            </p>
          </div>

          {/* Coluna 2: navegação interna */}
          <div>
            <h4 className="font-bold mb-3">Produto</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li>
                <a href="#como-funciona" className="hover:text-white transition">
                  Como funciona
                </a>
              </li>
              <li>
                <a href="#precos" className="hover:text-white transition">
                  Preços
                </a>
              </li>
              <li>
                <a href="#comecar" className="hover:text-white transition">
                  Testar grátis
                </a>
              </li>
            </ul>
          </div>

          {/* Coluna 3: contato (todos funcionais) */}
          <div>
            <h4 className="font-bold mb-3">Contato</h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li>
                <a
                  href={WA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white transition"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={`https://instagram.com/${INSTAGRAM}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white transition"
                >
                  <Instagram size={14} /> @{INSTAGRAM}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex items-center gap-2 hover:text-white transition"
                >
                  <Mail size={14} /> {EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Rodapé legal */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-white/50">
          <p>© {year} Fity AI · Feito com 💚 no Brasil</p>
          <div className="flex gap-5">
            <Link href="/termos" className="hover:text-white transition">
              Termos
            </Link>
            <Link
              href="/privacidade"
              className="hover:text-white transition"
            >
              Privacidade
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
