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
  // Disable experimental features that might cause issues
  experimental: {
    // Keep only the essential experimental features
    appDir: true,
  }
}

export default nextConfig;
