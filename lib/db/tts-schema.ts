import { sql } from "drizzle-orm"
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "@/lib/db/auth-schema"

/** Audio and other binary blobs, stored in the row. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
})

/** API keys for /v1: the key itself is shown once; only its SHA-256 is kept. */
export const apiKey = pgTable(
  "api_keys",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** The first characters of the key, so a member can tell keys apart. */
    prefix: text().notNull(),
    hash: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.userId)]
)

/** A consent recording: the speaker reads the fixed sentence for its
 * language. The worker transcribes it; only a verified one can make a voice. */
export const voiceConsent = pgTable(
  "voice_consents",
  {
    /** cons_<hex>, as the OpenAI API names them. */
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    language: text().notNull(),
    recording: bytea().notNull(),
    mime: text().notNull(),
    /** pending until the worker checks it, then verified or rejected. */
    status: text().notNull().default("pending"),
    transcript: text(),
    /** How close the transcript is to the sentence, 0 to 1. */
    score: real(),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)]
)

/** A voice speech can be made in: a member's own (from a verified consent of
 * the same speaker) or a built-in one an admin added. */
export const voice = pgTable(
  "voices",
  {
    /** voice_<hex>, as the OpenAI API names them. */
    id: text().primaryKey(),
    /** The owner; built-in voices belong to the admin who added them. */
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** Built-in voices are called by name ("cc") and open to every member. */
    builtin: boolean().notNull().default(false),
    /** A member's voice is private until they share it with every member. */
    shared: boolean().notNull().default(false),
    consentId: text().references(() => voiceConsent.id, {
      onDelete: "set null",
    }),
    /** For built-in voices: how the speaker agreed, in words. */
    consentNote: text(),
    sample: bytea().notNull(),
    mime: text().notNull(),
    /** Speaker similarity of the sample to the consent recording, 0 to 1. */
    similarity: real(),
    /** The sample's speaker embedding (ECAPA), to refuse a new voice that
     * copies someone else's. */
    embedding: real().array(),
    /** pending until the worker compares the speakers, then ready or rejected. */
    status: text().notNull().default("pending"),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)]
)

/** Work for the GPU worker. Speech results stay a day for their link. */
export const job = pgTable(
  "jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** speech, consent (check the sentence) or voice (compare the speakers). */
    kind: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** What the worker needs, e.g. { input, voiceId, format, speed }. */
    params: jsonb().$type<Record<string, unknown>>().notNull(),
    /** For speech: characters, counted as usage. */
    chars: integer().notNull().default(0),
    /** api, web or mcp. */
    via: text().notNull(),
    status: text().notNull().default("queued"),
    result: bytea(),
    resultMime: text(),
    /** Seconds of audio produced. */
    seconds: real(),
    error: text(),
    /** The secret in the result's download link. */
    linkSecret: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("jobs_queue_idx")
      .on(t.createdAt)
      .where(sql`${t.status} = 'queued'`),
    index().on(t.userId, t.createdAt),
  ]
)
