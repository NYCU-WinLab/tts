import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "@/lib/db/schema"

// One pool per server process. DATABASE_URL points at the compose Postgres.
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const db = drizzle(pool, { schema, casing: "snake_case" })
export type Db = typeof db
