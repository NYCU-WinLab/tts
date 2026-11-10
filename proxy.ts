import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// A fast first gate: no session cookie, no page. Pages still check the
// session itself (requireActor); a cookie alone proves nothing.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  const url = new URL("/sign-in", request.url)
  url.searchParams.set("next", request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Open: sign-in and consent (they handle their own state), the auth and
  // MCP endpoints (they answer with OAuth errors, not redirects), the LiveKit
  // webhook (it checks its own signature), the service actions (they check
  // their own key), guest links (the secret in the link is checked by the
  // page), discovery documents and static files.
  matcher: [
    "/((?!(?:sign-in|consent|a|v1|api/auth|api/worker|mcp|\\.well-known|_next/static|_next/image)(?:/|$)|icon\\.png$|apple-icon\\.png$).*)",
  ],
}
