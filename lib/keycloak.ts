// Reads Keycloak with the tts client's own service account, which holds
// only realm-management view-users: it can look members up, never change
// them. Members change their account in Keycloak's account console.

const issuer = () => process.env.KEYCLOAK_ISSUER!
const timeout = () => AbortSignal.timeout(5000)
let cached: { token: string; expires: number } | null = null

async function adminToken() {
  if (cached && cached.expires > Date.now() + 10_000) return cached.token
  const response = await fetch(`${issuer()}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.KEYCLOAK_CLIENT_ID!,
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
    }),
    cache: "no-store",
    signal: timeout(),
  })
  if (!response.ok) throw new Error(`Keycloak token ${response.status}`)
  const body = (await response.json()) as {
    access_token: string
    expires_in: number
  }
  cached = {
    token: body.access_token,
    expires: Date.now() + body.expires_in * 1000,
  }
  return cached.token
}

export type KeycloakUser = {
  username: string
  enabled?: boolean
  email?: string
  firstName?: string
  lastName?: string
  attributes?: Record<string, string[]>
}

/** One member's Keycloak record by their Keycloak id (the OIDC sub), or
 * null when Keycloak no longer has the account. */
export async function findKeycloakUser(
  sub: string
): Promise<KeycloakUser | null> {
  const url = `${issuer().replace("/realms/", "/admin/realms/")}/users/${encodeURIComponent(sub)}`
  const get = async () =>
    fetch(url, {
      headers: { authorization: `Bearer ${await adminToken()}` },
      cache: "no-store",
      signal: timeout(),
    })
  let response = await get()
  // A token Keycloak dropped early (restart, revocation): fetch a new one once.
  if (response.status === 401) {
    cached = null
    response = await get()
  }
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Keycloak user ${response.status}`)
  return (await response.json()) as KeycloakUser
}
