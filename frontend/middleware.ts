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

  // HOST-LESS relative redirect: the browser resolves a Location with no host
  // against the origin it is actually on. Behind the Tailscale Funnel, request.url's
  // host is the loopback the funnel proxies to (localhost:3000), so an absolute
  // redirect built from it sent every signed-out student to their OWN machine
  // (https://localhost:3000/login). A relative Location also keeps ONE ORIGIN's
  // rule that nothing shipped names a host. `next` = where they were headed, so a
  // deep-link to a topic returns there after login, not the dashboard.
  const next = request.nextUrl.pathname
  const location = `/login?next=${encodeURIComponent(next)}`
  return new NextResponse(null, { status: 307, headers: { Location: location } })
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
