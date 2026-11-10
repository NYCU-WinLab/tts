import { auth } from "@/lib/auth"
import { safeNext } from "@/lib/safe-next"

// No sign-in page: every page needs a member, so /sign-in goes straight to
// Keycloak. An MCP authorization arrives here with its signed query, which
// is passed on as oauth_query so the authorization resumes after sign-in.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get("next"))
  const authorizing = url.searchParams.has("sig")

  if (!authorizing) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (session) return Response.redirect(new URL(next, url), 303)
  }

  const signed = new URLSearchParams(url.searchParams)
  signed.delete("next")
  const response = await auth.api.signInSocial({
    body: {
      provider: "keycloak",
      callbackURL: next,
      errorCallbackURL: "/sign-in/failed",
      ...(authorizing ? { oauth_query: signed.toString() } : {}),
    },
    headers: request.headers,
    asResponse: true,
  })
  const { url: keycloak } = (await response.json()) as { url: string }
  // Keep the state cookies Better Auth set for the callback.
  const redirect = new Response(null, {
    status: 303,
    headers: { location: keycloak },
  })
  for (const cookie of response.headers.getSetCookie())
    redirect.headers.append("set-cookie", cookie)
  return redirect
}
