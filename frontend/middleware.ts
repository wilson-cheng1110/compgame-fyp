import { NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Check if trying to access /games routes
  if (pathname.startsWith("/games/")) {
    // Check for user cookie
    const userCookie = request.cookies.get("user")

    if (!userCookie) {
      // Redirect to login if no auth cookie
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/games/:path*"]
}
