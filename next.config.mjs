import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */

// Cible du backend, utilisée uniquement côté serveur par le proxy `/api`.
// Le navigateur n'appelle que l'origine du front, donc le cookie de session
// reste first-party (les cookies tiers sont bloqués par Chrome/Edge).
// Priorité : API_PROXY_TARGET > NEXT_PUBLIC_API_URL > backend local.
const apiTarget = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  `http://localhost:${process.env.NEXT_PUBLIC_API_PORT || '5001'}`
)
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '10.28.73.66', '10.20.12.75'],

  async rewrites() {
    if (!apiTarget) return []
    return [{ source: '/api/:path*', destination: `${apiTarget}/api/:path*` }]
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
