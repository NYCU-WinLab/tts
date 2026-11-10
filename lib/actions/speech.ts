import { randomBytes } from "node:crypto"

import { and, desc, eq, gte, sql } from "drizzle-orm"
import { z } from "zod"

import { defineAction } from "@/lib/actions/define"
import {
  enqueue,
  RESULT_TTL_MS,
  waitFor,
  workerOnline,
} from "@/lib/actions/jobs"
import { resolveVoice } from "@/lib/actions/voices"
import { db } from "@/lib/db"
import { job } from "@/lib/db/schema"

// Text to speech. The worker makes the audio in the voice asked for; the
// result keeps a secret link for a day, which MCP clients and pages play.

export const MAX_INPUT = 1000
const MAX_PENDING = 3
const SPEECH_TIMEOUT_MS = 180_000

export const FORMATS = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/pcm",
} as const
export type SpeechFormat = keyof typeof FORMATS

export function audioUrl(id: string, secret: string, format: string) {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  return new URL(`/a/${id}/${secret}.${format}`, base).toString()
}

export const speak = defineAction({
  name: "speak",
  title: "產生語音",
  description:
    "Speaks text in a voice: a built-in's name (such as cc) or a voice id from list_voices. Waits for the audio (a sentence takes a few seconds) and returns a link to it that works for 24 hours without signing in, with its length in seconds.",
  kind: "mutation",
  input: z.object({
    input: z
      .string()
      .trim()
      .min(1, "請輸入文字")
      .max(MAX_INPUT, `最多 ${MAX_INPUT} 字`),
    voice: z.string().trim().min(1, "請選聲音"),
    format: z
      .enum(Object.keys(FORMATS) as [SpeechFormat, ...SpeechFormat[]])
      .default("mp3"),
    speed: z.number().min(0.25).max(4).default(1),
  }),
  run: async (actor, input) => {
    const found = await resolveVoice(actor, input.voice)
    if (!found) throw new Error(`找不到聲音「${input.voice}」`)
    if (!workerOnline()) throw new Error("語音主機離線，請稍後再試")
    const linkSecret = randomBytes(16).toString("base64url")
    const id = await enqueue(
      {
        kind: "speech",
        userId: actor.userId,
        params: {
          input: input.input,
          voiceId: found.id,
          format: input.format,
          speed: input.speed,
        },
        chars: [...input.input].length,
        via: actor.via,
        linkSecret,
      },
      MAX_PENDING
    )
    if (!id) throw new Error("你已經有好幾段在排隊，請等它們完成")
    const done = await waitFor(id, SPEECH_TIMEOUT_MS)
    if (done.status === "failed")
      throw new Error(`語音產生失敗：${done.error ?? "原因不明"}`)
    return {
      id,
      voice: found.name,
      format: input.format,
      seconds: done.seconds,
      url: audioUrl(id, linkSecret, input.format),
      expiresAt: new Date(Date.now() + RESULT_TTL_MS).toISOString(),
    }
  },
})

export const myUsage = defineAction({
  name: "my_usage",
  title: "我的用量",
  description:
    "How much the signed-in member used in the last 30 days: speech requests, characters and seconds of audio, split by where they came from (api, web, mcp).",
  kind: "query",
  input: z.object({}),
  run: async (actor) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const rows = await db
      .select({
        via: job.via,
        requests: sql<number>`count(*)::int`,
        chars: sql<number>`coalesce(sum(${job.chars}), 0)::int`,
        seconds: sql<number>`coalesce(round(sum(${job.seconds})::numeric, 1), 0)::float`,
      })
      .from(job)
      .where(
        and(
          eq(job.userId, actor.userId),
          eq(job.kind, "speech"),
          eq(job.status, "done"),
          gte(job.createdAt, since)
        )
      )
      .groupBy(job.via)
      .orderBy(desc(sql`count(*)`))
    return { since: since.toISOString(), byVia: rows }
  },
})
