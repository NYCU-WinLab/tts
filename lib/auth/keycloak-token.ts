import { and, eq } from "drizzle-orm"
import { createRemoteJWKSet, errors, jwtVerify } from "jose"

import { db } from "@/lib/db"
import { account } from "@/lib/db/schema"

// MCP clients sign in at Keycloak (realm winlab) with the public client
// tts-mcp, and /mcp takes the Keycloak access token. The issuer and its keys
// come from KEYCLOAK_ISSUER, never from the token, and the audience must be
// this server's /mcp (an audience mapper on tts-mcp puts it there).

const issuer = () => process.env.KEYCLOAK_ISSUER!
// Only tokens this client asked for: another client given the same
// audience scope by mistake still cannot act for members here.
const mcpClient = () => process.env.KEYCLOAK_MCP_CLIENT_ID ?? "tts-mcp"
let keys: ReturnType<typeof createRemoteJWKSet> | null = null
const jwks = () =>
  (keys ??= createRemoteJWKSet(
    new URL(`${issuer()}/protocol/openid-connect/certs`)
  ))

export type McpCaller = {
  userId: string
  clientId: string
  scopes: string[]
  expiresAt?: number
}

export class TokenRefused extends Error {
  constructor(
    readonly status: 401 | 403 | 503,
    message: string
  ) {
    super(message)
  }
}

/** The member a Keycloak access token acts for, or TokenRefused. */
export async function verifyKeycloakToken(
  token: string,
  audience: string
): Promise<McpCaller> {
  let claims
  try {
    ;({ payload: claims } = await jwtVerify(token, jwks(), {
      issuer: issuer(),
      audience,
    }))
  } catch (error) {
    // Keycloak's keys out of reach is an outage, not a bad token: a 401
    // would send every client back to sign in again.
    if (
      !(error instanceof errors.JOSEError) ||
      error instanceof errors.JWKSTimeout
    )
      throw new TokenRefused(503, "cannot reach Keycloak to check the token")
    throw new TokenRefused(401, "invalid token")
  }
  // An ID token can carry the same issuer; only access tokens are Bearer.
  if (claims.typ !== "Bearer" || typeof claims.sub !== "string")
    throw new TokenRefused(401, "not an access token")
  if (claims.azp !== mcpClient())
    throw new TokenRefused(401, "token not issued for this MCP server")
  // The member is whoever signed in here with this Keycloak account. A
  // service account, or someone who never signed in, has no such row.
  const [link] = await db
    .select({ userId: account.userId })
    .from(account)
    .where(
      and(eq(account.providerId, "keycloak"), eq(account.accountId, claims.sub))
    )
  if (!link)
    throw new TokenRefused(
      403,
      "sign in at the TTS website once, then connect again"
    )
  return {
    userId: link.userId,
    clientId: claims.azp,
    scopes: String(claims.scope ?? "")
      .split(" ")
      .filter(Boolean),
    expiresAt: claims.exp,
  }
}
