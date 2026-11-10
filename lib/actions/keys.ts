import { createHash, randomBytes } from "node:crypto"

import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"

import { type Actor, defineAction } from "@/lib/actions/define"
import { isLabMember } from "@/lib/auth/member"
import { db } from "@/lib/db"
import { apiKey } from "@/lib/db/schema"

// API keys for the OpenAI-style /v1 endpoints. A key is shown once when it
// is made; the database keeps its SHA-256 and the first characters only.

const MAX_KEYS = 10
const hash = (key: string) => createHash("sha256").update(key).digest("hex")

export const listApiKeys = defineAction({
  name: "list_api_keys",
  title: "API 金鑰",
  description:
    "The signed-in member's API keys for the OpenAI-compatible /v1 endpoints: id, name, the first characters of the key, when it was made and last used. Revoked keys are left out. The secret itself is never shown again.",
  kind: "query",
  input: z.object({}),
  run: async (actor) => {
    const keys = await db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt,
      })
      .from(apiKey)
      .where(and(eq(apiKey.userId, actor.userId), isNull(apiKey.revokedAt)))
      .orderBy(desc(apiKey.createdAt))
    return { keys }
  },
})

export const createApiKey = defineAction({
  name: "create_api_key",
  title: "建立 API 金鑰",
  description:
    "Makes an API key for the /v1 endpoints, acting as the signed-in member. Returns the key once; it cannot be shown again.",
  kind: "mutation",
  input: z.object({ name: z.string().trim().min(1, "請填名稱").max(60) }),
  run: async (actor, input) => {
    const { keys } = await listApiKeys.run(actor, {})
    if (keys.length >= MAX_KEYS) throw new Error(`最多 ${MAX_KEYS} 把金鑰`)
    const key = `sk-tts-${randomBytes(24).toString("base64url")}`
    const [row] = await db
      .insert(apiKey)
      .values({
        userId: actor.userId,
        name: input.name,
        prefix: key.slice(0, 12),
        hash: hash(key),
      })
      .returning({ id: apiKey.id })
    return { id: row.id, key }
  },
  mcpExcludedBecause:
    "It mints a credential; a member makes keys on the page, where the secret is shown once.",
})

export const revokeApiKey = defineAction({
  name: "revoke_api_key",
  title: "撤銷 API 金鑰",
  description:
    "Revokes one of the signed-in member's API keys by id; calls with it fail from then on.",
  kind: "mutation",
  input: z.object({ id: z.uuid() }),
  run: async (actor, input) => {
    const revoked = await db
      .update(apiKey)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(apiKey.id, input.id),
          eq(apiKey.userId, actor.userId),
          isNull(apiKey.revokedAt)
        )
      )
      .returning({ id: apiKey.id })
    if (!revoked.length) throw new Error("找不到這把金鑰")
    return { id: input.id }
  },
})

/** The member an Authorization header's key acts as, or null. A member who
 * left the lab (disabled in Keycloak) gets null too. */
export async function actorFromApiKey(
  authorization: string | null
): Promise<Actor | null> {
  const key = authorization?.match(/^Bearer\s+(sk-tts-\S+)$/i)?.[1]
  if (!key) return null
  const [row] = await db
    .select({ id: apiKey.id, userId: apiKey.userId })
    .from(apiKey)
    .where(and(eq(apiKey.hash, hash(key)), isNull(apiKey.revokedAt)))
  if (!row) return null
  if (!(await isLabMember(row.userId))) return null
  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, row.id))
  return { userId: row.userId, via: "api" }
}
