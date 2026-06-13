/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  transpilePackages: ["lucide-react"],
}

module.exports = nextConfig
