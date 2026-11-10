// Tells every open page that data changed, so members see each other's
// edits without reloading. A mutation announces itself with Postgres
// NOTIFY; this process LISTENs on one connection and fans the news out to
// the pages subscribed through /api/events. Only the action's name travels,
// never member data.
import { EventEmitter } from "node:events"

import { sql } from "drizzle-orm"
import { Client } from "pg"

import { db } from "@/lib/db"

const CHANNEL = "tts_changes"

/** Called after a mutation commits. */
export async function announceChange(action: string) {
  await db.execute(sql`select pg_notify(${CHANNEL}, ${action})`)
}

const changes = new EventEmitter()
changes.setMaxListeners(0)
let listening: Promise<void> | null = null

// One LISTEN connection per server process, opened on first use and opened
// again after it drops while anyone is still subscribed.
function listen() {
  listening ??= (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    const reopen = () => {
      listening = null
      client.end().catch(() => {})
      if (changes.listenerCount("change") > 0)
        setTimeout(() => listen().catch(() => {}), 2000)
    }
    client.on("notification", (message) =>
      changes.emit("change", message.payload ?? "")
    )
    client.on("error", reopen)
    client.on("end", reopen)
    await client.connect()
    await client.query(`LISTEN ${CHANNEL}`)
  })().catch((error) => {
    listening = null
    throw error
  })
  return listening
}

/** Calls handler with the action name after every mutation, until the
 * returned function is called. */
export async function onChange(handler: (action: string) => void) {
  changes.on("change", handler)
  try {
    await listen()
  } catch (error) {
    changes.off("change", handler)
    throw error
  }
  return () => {
    changes.off("change", handler)
  }
}
