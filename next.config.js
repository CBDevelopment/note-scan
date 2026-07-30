/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/notescan',
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client'],
  },
}

module.exports = nextConfig
