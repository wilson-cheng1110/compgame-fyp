let userConfig = undefined
try {
  // try to import ESM first
  userConfig = await import('./v0-user-next.config.mjs')
} catch (e) {
  try {
    // fallback to CJS import
    userConfig = await import("./v0-user-next.config");
  } catch (innerError) {
    // ignore error
  }
}

// The API the browser never sees. Everything client-side calls a RELATIVE /api/...
// (see lib/api.ts) and this rewrite proxies it to FastAPI on loopback, so the whole
// deployment is ONE origin on ONE exposed port. The tunnel points at 3000 and nothing
// else; 8080 is never published.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8080"

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }]
  },
  // `next dev` and `next start` must NOT share a build directory. When they did,
  // dev rewrote .next/app-build-manifest.json into its own form and the production
  // server started serving dev chunk names (unhashed main-app.js / polyfills.js).
  // Those 404, so pages rendered and then never hydrated -- the topic unit sat on
  // "Loading..." forever. It looked like the machine was corrupting .next at random;
  // it was a dev server in the same checkout. Diagnosed 2026-08-27.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
}

// NOTE for whoever edits v0-user-next.config.mjs: the merge below spreads plain
// objects but REPLACES anything else, and `rewrites` is a function. Defining
// `rewrites` over there would silently replace the one above and every API call in
// the app would 404 with no build error. Do not.
if (userConfig) {
  // ESM imports will have a "default" property
  const config = userConfig.default || userConfig

  for (const key in config) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...config[key],
      }
    } else {
      nextConfig[key] = config[key]
    }
  }
}

export default nextConfig
