import { headers } from "next/headers"
import { redirect } from "next/navigation"

import type { Actor } from "@/lib/actions/define"
import { auth } from "@/lib/auth"

/** The signed-in member's session, or null. Reads cookies, so server only. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/** The member a page acts as; sends anyone signed out to /sign-in. */
export async function requireActor(next = "/"): Promise<Actor> {
  const session = await getSession()
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  return { userId: session.user.id, via: "web" }
}
