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
  // output: 'standalone' was here, added blind by v0 with the comment "to ensure
  // proper build". It does the opposite: `next start` REFUSES to serve a standalone
  // build ("next start does not work with output: standalone"), and the failure mode
  // is vicious — the HTML still renders 200, so a smoke test passes, while every
  // /_next/static/* asset 400s. No CSS, no JS, no hydration: an unstyled page whose
  // login form silently falls back to a native GET. That is what 300 students would
  // have got on launch day, because docs/runbook.md §2 deploys with `npm run start`.
  //
  // Removed 2026-08-21, found by the browser tests. Standalone buys nothing here:
  // there is no Docker image, and it needs public/ and .next/static/ hand-copied into
  // .next/standalone/ — an undocumented step whose omission produces this exact bug.
  // If it is ever wanted back, the runbook must change to
  // `node .next/standalone/server.js` in the same commit.
  // (Removed experimental.appDir — App Router has been stable since Next 13.4
  //  and the obsolete key triggered an "Unrecognized key" warning on every boot.)
}

export default nextConfig;
