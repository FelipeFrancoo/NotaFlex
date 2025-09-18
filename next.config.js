/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    // Adicione configurações experimentais se necessário
  },
  // Configurações para assets estáticos
  images: {
    domains: [], // Adicione domínios de imagens externas se necessário
  },
}

module.exports = nextConfig