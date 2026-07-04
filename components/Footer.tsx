"use client";
import { MessageCircle, Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-ink-900 text-white pt-16 pb-10">
      <div className="container-wide">
        <div className="grid sm:grid-cols-3 gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center font-bold text-lg">
                F
              </div>
              <span className="font-extrabold text-xl">Fity</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              O assistente que decide por você: o que comer, o que treinar,
              e o que comprar. Todo dia, no WhatsApp.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-3">Produto</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><a href="#como-funciona" className="hover:text-white">Como funciona</a></li>
              <li><a href="#precos" className="hover:text-white">Preços</a></li>
              <li><a href="#comecar" className="hover:text-white">Testar grátis</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-3">Contato</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li>
                <a
                  href="https://wa.me/5511999999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/fity"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <Instagram size={14} /> @fity
                </a>
              </li>
              <li>contato@fity.com.br</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-white/50">
          <p>© 2026 Fity · Feito com 💚 no Brasil</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white">Termos</a>
            <a href="#" className="hover:text-white">Privacidade</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
