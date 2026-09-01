import { NextRequest, NextResponse } from "next/server"

/**
 * A CONVENIENCE REDIRECT, NOT A SECURITY BOUNDARY.
 *
 * The `user` cookie is UI decoration (docs/revamp.md Part 0) — it is not signed,
 * not HttpOnly, and a student can mint one in devtools in ten seconds. Everything
 * that actually matters is gated server-side on the HttpOnly `session` cookie:
 * `/api/topics/*` re-checks the session, the consent record, and the release
 * window on every call, and the answer key never leaves `checks.py`.
 *
 * What this file buys is that a logged-out student sees /login instead of a page
 * that flashes and then errors. That's it. Do not add authorisation logic here.
 *
 * The matcher previously covered `/games/:path*` only — which was correct when
 * games were the whole app, and stopped being correct when the topic unit became
 * the main path. `/topics/*` is now where a student spends the session.
 */
export function middleware(request: NextRequest) {
  const userCookie = request.cookies.get("user")
  if (userCookie) return NextResponse.next()

  // Behind the Tailscale Funnel the Host header is the loopback the funnel proxies
  // to (localhost:3000), so a redirect built from request.url pointed signed-out
  // students at their OWN machine. The funnel forwards the real public host in
  // X-Forwarded-Host — prefer it, and fall back to the request origin for direct/
  // localhost access. NextResponse.redirect needs an ABSOLUTE URL: Next validates
  // the Location with `new URL(location)` and a host-less/relative value throws
  // (500). So build an absolute URL against the forwarded origin.
  const fwdHost = request.headers.get("x-forwarded-host")
  const fwdProto = request.headers.get("x-forwarded-proto") ?? "https"
  const base = fwdHost ? `${fwdProto}://${fwdHost}` : request.nextUrl.origin
  const url = new URL("/login", base)
  // Come back where they were headed once they're in — a student who deep-links
  // to a topic from the release announcement shouldn't land on the dashboard.
  url.searchParams.set("next", request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    "/games/:path*",
    "/topics/:path*",
    "/dashboard/:path*",
    "/badges/:path*",
    "/consent/:path*",
    "/onboarding/:path*",
  ],
}
