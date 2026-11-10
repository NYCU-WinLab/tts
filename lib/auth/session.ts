import { headers } from "next/headers"
import { redirect } from "next/navigation"

import type { Actor } from "@/lib/actions/define"
import { auth } from "@/lib/auth"
import { isLabMember } from "@/lib/auth/member"

/** The signed-in member's session, or null. Reads cookies, so server only.
 * Someone Keycloak no longer lists as an enabled member has no session:
 * isLabMember deletes theirs. */
export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  return (await isLabMember(session.user.id)) ? session : null
}

/** The member a page acts as; sends anyone signed out to /sign-in. */
export async function requireActor(next = "/"): Promise<Actor> {
  const session = await getSession()
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  return { userId: session.user.id, via: "web" }
}
