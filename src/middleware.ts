import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("authjs.session-token") || request.cookies.get("__Secure-authjs.session-token")
  if (!sessionCookie && !request.nextUrl.pathname.startsWith("/login") && !request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (sessionCookie && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
