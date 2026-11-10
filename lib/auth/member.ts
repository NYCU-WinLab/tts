import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { account, oauthRefreshToken, session } from "@/lib/db/schema"
import { findKeycloakUser } from "@/lib/keycloak"

// MCP access tokens are JWTs checked against the JWKS alone, and refresh
// tokens keep renewing them, so leaving the lab would not end MCP access.
// /mcp asks this on every call instead: is the member still an enabled
// account in Keycloak (realm winlab)? Someone who left loses access within
// the cache window, and their refresh tokens and sessions are deleted so
// they cannot come back without signing in through Keycloak again.

const CHECK_EVERY_MS = 5 * 60 * 1000
// While Keycloak is unreachable, a member seen recently keeps access.
const TRUST_WHILE_DOWN_MS = 60 * 60 * 1000

const seen = new Map<string, { member: boolean; at: number }>()

export async function isLabMember(userId: string): Promise<boolean> {
  const last = seen.get(userId)
  if (last && Date.now() - last.at < CHECK_EVERY_MS) return last.member

  let member: boolean
  try {
    const [link] = await db
      .select({ sub: account.accountId })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "keycloak"))
      )
    const keycloakUser = link ? await findKeycloakUser(link.sub) : null
    member = keycloakUser?.enabled === true
  } catch (error) {
    if (last?.member && Date.now() - last.at < TRUST_WHILE_DOWN_MS) return true
    throw error
  }

  seen.set(userId, { member, at: Date.now() })
  if (!member) {
    await db.transaction(async (tx) => {
      await tx
        .delete(oauthRefreshToken)
        .where(eq(oauthRefreshToken.userId, userId))
      await tx.delete(session).where(eq(session.userId, userId))
    })
  }
  return member
}
