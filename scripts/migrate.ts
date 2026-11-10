// Applies drizzle/*.sql in order. Bundled into the image as migrate.mjs and
// run by compose's one-shot migrate service before web starts.
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
await migrate(drizzle(pool), { migrationsFolder: "drizzle" })
await pool.end()
console.log("migrations applied")
