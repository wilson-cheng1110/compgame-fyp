/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['hebbkx1anhila5yf.public.blob.vercel-storage.com', 'v0.blob.com'],
  },
  // Add this to handle Windows paths
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  // Add output option to ensure proper build
  output: 'standalone',
  // (Removed experimental.appDir — App Router has been stable since Next 13.4
  //  and the obsolete key triggered an "Unrecognized key" warning on every boot.)
}

export default nextConfig;
