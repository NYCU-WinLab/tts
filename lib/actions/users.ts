import { eq } from "drizzle-orm"
import { z } from "zod"

import { defineAction } from "@/lib/actions/define"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"

export const whoami = defineAction({
  name: "whoami",
  title: "我是誰",
  description:
    "The signed-in member: id, name (Chinese name from Keycloak), email and lab account username. Call it first to know who you act as.",
  kind: "query",
  input: z.object({}),
  run: async (actor) => {
    const [member] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
      })
      .from(user)
      .where(eq(user.id, actor.userId))
    if (!member) throw new Error("找不到這個成員")
    return member
  },
})
