import { verifyOAuthQueryParams } from "@better-auth/oauth-provider"
import { eq } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { oauthClient } from "@/lib/db/schema"

/**
 * The client asking for access, from the consent page's signed query, or
 * null when the query was altered or has expired.
 */
export async function getConsentRequest(query: string) {
  const { secret } = await auth.$context
  if (!(await verifyOAuthQueryParams(query, secret))) return null
  const params = new URLSearchParams(query)
  const clientId = params.get("client_id")
  if (!clientId) return null
  const [client] = await db
    .select({ name: oauthClient.name, redirectUris: oauthClient.redirectUris })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
  // The name is whatever the client registered, so show where the token
  // goes too: the CIMD client_id host, or else its redirect host.
  const redirect = (client?.redirectUris as string[] | undefined)?.[0]
  return {
    clientId,
    name: client?.name || clientId,
    host: hostOf(clientId) ?? (redirect ? hostOf(redirect) : null),
  }
}

function hostOf(url: string) {
  try {
    const { protocol, host } = new URL(url)
    return protocol === "https:" || protocol === "http:" ? host : null
  } catch {
    return null
  }
}
