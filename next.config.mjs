/** @type {import('next').NextConfig} */
const nextConfig = {
  // IMPORTANTE: StrictMode desligado por causa do Payment Brick do Mercado Pago.
  // O SDK do MP tem problema com double-mount (cria 2 iframes duplicados em dev).
  // O Brick funciona corretamente em producao sem strict mode.
  // Em dev, ligamos so de proposito se nao tiver nada do MP.
  reactStrictMode: false,
};
export default nextConfig;
