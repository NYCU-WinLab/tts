// The queue between the web app and the GPU worker. The worker sits behind
// NAT on another network, so it only calls out: it long-polls
// /api/worker/next for a job, fetches what it needs, and posts the result to
// /api/worker/jobs/<id>. Callers wait on the row. Not actions: only the
// worker routes and the actions in this folder use these.
import { createHash, timingSafeEqual } from "node:crypto"

import { and, eq, lt, ne, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { job, voice, voiceConsent } from "@/lib/db/schema"

export type JobKind = "speech" | "consent" | "voice"

/** A job the worker has not reported on in this long went with a crash. */
const RUNNING_TIMEOUT_MS = 5 * 60 * 1000
/** Speech results, and their links, are kept this long. */
export const RESULT_TTL_MS = 24 * 60 * 60 * 1000
/** The worker counts as online while it polled this recently. */
const ONLINE_MS = 60 * 1000

let workerSeenAt = 0

export function workerOnline() {
  return Date.now() - workerSeenAt < ONLINE_MS
}

/** Checks the worker's bearer token in constant time. */
export function isWorker(authorization: string | null) {
  const expected = process.env.WORKER_TOKEN
  const given = authorization?.replace(/^Bearer\s+/i, "")
  if (!expected || !given) return false
  const a = createHash("sha256").update(given).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

/** Queues a job. With maxPending, refuses (returns null) when the member
 * already has that many waiting or running; a per-member lock makes the
 * count and the insert one step, so parallel requests cannot pass it. */
export async function enqueue(
  values: {
    kind: JobKind
    userId: string
    params: Record<string, unknown>
    chars?: number
    via: string
    linkSecret?: string
  },
  maxPending?: number
) {
  return db.transaction(async (tx) => {
    if (maxPending !== undefined) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${values.userId}))`
      )
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(job)
        .where(
          and(
            eq(job.userId, values.userId),
            sql`${job.status} in ('queued','running')`
          )
        )
      if (row.n >= maxPending) return null
    }
    const [row] = await tx.insert(job).values(values).returning({ id: job.id })
    return row.id
  })
}

/** Waits until the worker finishes the job or the time runs out. */
export async function waitFor(id: string, timeoutMs: number) {
  const until = Date.now() + timeoutMs
  for (let delay = 100; ; delay = Math.min(delay * 1.5, 500)) {
    const [row] = await db
      .select({
        status: job.status,
        error: job.error,
        seconds: job.seconds,
        resultMime: job.resultMime,
      })
      .from(job)
      .where(eq(job.id, id))
    if (!row) throw new Error("工作不見了")
    if (row.status === "done" || row.status === "failed") return row
    if (Date.now() > until) {
      // Nobody waits for it any more: drop it if the worker has not started,
      // and reject the consent or voice it was checking.
      const dropped = await db
        .update(job)
        .set({ status: "failed", error: "timeout", finishedAt: new Date() })
        .where(and(eq(job.id, id), eq(job.status, "queued")))
        .returning({ kind: job.kind, params: job.params })
      for (const { kind, params } of dropped) {
        if (kind === "consent")
          await db
            .update(voiceConsent)
            .set({ status: "rejected", reason: "檢查逾時" })
            .where(eq(voiceConsent.id, String(params.consentId)))
        if (kind === "voice")
          await db
            .update(voice)
            .set({ status: "rejected", reason: "檢查逾時" })
            .where(eq(voice.id, String(params.voiceId)))
      }
      throw new Error("語音產生逾時，請稍後再試")
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

/** Gives the oldest queued job to the worker, or null after waitMs. */
export async function claimNext(worker: string, waitMs: number) {
  workerSeenAt = Date.now()
  // A job left running by a worker that died goes back in the queue once.
  await db
    .update(job)
    .set({ status: "queued", startedAt: null })
    .where(
      and(
        eq(job.status, "running"),
        lt(job.startedAt, new Date(Date.now() - RUNNING_TIMEOUT_MS))
      )
    )
  const until = Date.now() + waitMs
  for (;;) {
    const claimed = await db.execute<{ id: string }>(sql`
      update ${job} set status = 'running', started_at = now()
      where id = (
        select id from ${job} where status = 'queued'
        order by created_at limit 1 for update skip locked
      )
      returning id`)
    const id = claimed.rows[0]?.id
    if (id) {
      const [row] = await db
        .select({ id: job.id, kind: job.kind, params: job.params })
        .from(job)
        .where(eq(job.id, id))
      return row
    }
    if (Date.now() > until) return null
    workerSeenAt = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 300))
    void worker
  }
}

/** What the worker reports for a job. Audio for speech; a verdict for checks. */
export type JobReport =
  | { kind: "speech"; audio: Buffer; mime: string; seconds: number }
  | {
      kind: "consent"
      ok: boolean
      transcript: string
      score: number
      reason?: string
    }
  | {
      kind: "voice"
      ok: boolean
      similarity: number
      embedding?: number[]
      reason?: string
    }
  | { kind: "error"; error: string }

export async function finishJob(id: string, report: JobReport) {
  const [row] = await db
    .select({ kind: job.kind, params: job.params, status: job.status })
    .from(job)
    .where(eq(job.id, id))
  if (!row || row.status !== "running") return false
  const finishedAt = new Date()

  if (report.kind === "error") {
    await db
      .update(job)
      .set({ status: "failed", error: report.error.slice(0, 500), finishedAt })
      .where(eq(job.id, id))
    // A check that failed to run leaves its consent or voice rejected.
    if (row.kind === "consent")
      await db
        .update(voiceConsent)
        .set({ status: "rejected", reason: "檢查失敗" })
        .where(eq(voiceConsent.id, String(row.params.consentId)))
    if (row.kind === "voice")
      await db
        .update(voice)
        .set({ status: "rejected", reason: "檢查失敗" })
        .where(eq(voice.id, String(row.params.voiceId)))
    return true
  }
  if (report.kind !== row.kind) return false

  await db.transaction(async (tx) => {
    if (report.kind === "speech") {
      await tx
        .update(job)
        .set({
          status: "done",
          result: report.audio,
          resultMime: report.mime,
          seconds: report.seconds,
          finishedAt,
        })
        .where(eq(job.id, id))
      return
    }
    await tx
      .update(job)
      .set({ status: "done", finishedAt })
      .where(eq(job.id, id))
    if (report.kind === "consent")
      await tx
        .update(voiceConsent)
        .set({
          status: report.ok ? "verified" : "rejected",
          transcript: report.transcript.slice(0, 1000),
          score: report.score,
          reason: report.ok ? null : (report.reason ?? "內容和句子不符"),
        })
        .where(eq(voiceConsent.id, String(row.params.consentId)))
    else {
      const voiceId = String(row.params.voiceId)
      const copied =
        report.ok && report.embedding
          ? await copiedVoice(voiceId, report.embedding)
          : null
      await tx
        .update(voice)
        .set({
          status: report.ok && !copied ? "ready" : "rejected",
          similarity: report.similarity,
          // Only a ready voice keeps its embedding: a rejected sample
          // must not block someone else's voice.
          embedding: report.ok && !copied ? (report.embedding ?? null) : null,
          reason: copied
            ? `和「${copied}」的聲音太像`
            : report.ok
              ? null
              : (report.reason ?? "和同意錄音不是同一人"),
        })
        .where(eq(voice.id, voiceId))
    }
  })
  return true
}

/** A member's new voice that sounds like a voice someone else owns is
 * refused, even with a consent: the consent could have been spoken by a
 * cloned voice. Voices an admin made skip the check. */
export const COPY_MAX_SIMILARITY = 0.6

const cosine = (a: number[], b: number[]) => {
  let dot = 0,
    na = 0,
    nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / Math.sqrt(na * nb)
}

async function copiedVoice(voiceId: string, embedding: number[]) {
  const [self] = await db
    .select({ userId: voice.userId, builtin: voice.builtin })
    .from(voice)
    .where(eq(voice.id, voiceId))
  if (!self || self.builtin) return null
  const others = await db
    .select({ name: voice.name, embedding: voice.embedding })
    .from(voice)
    .where(
      and(
        sql`${voice.embedding} is not null`,
        eq(voice.status, "ready"),
        sql`${voice.id} <> ${voiceId}`,
        ne(voice.userId, self.userId)
      )
    )
  for (const other of others)
    if (
      other.embedding?.length === embedding.length &&
      cosine(other.embedding, embedding) >= COPY_MAX_SIMILARITY
    )
      return other.name
  return null
}

/** Audio the worker needs: a voice's sample or a consent recording. */
export async function workerAudio(kind: "voice" | "consent", id: string) {
  if (kind === "voice") {
    const [row] = await db
      .select({ audio: voice.sample, mime: voice.mime })
      .from(voice)
      .where(eq(voice.id, id))
    return row ?? null
  }
  const [row] = await db
    .select({ audio: voiceConsent.recording, mime: voiceConsent.mime })
    .from(voiceConsent)
    .where(eq(voiceConsent.id, id))
  return row ?? null
}

/** A finished speech job's audio, when its link secret matches. */
export async function speechAudio(id: string, secret: string) {
  const [row] = await db
    .select({
      audio: job.result,
      mime: job.resultMime,
      linkSecret: job.linkSecret,
      finishedAt: job.finishedAt,
    })
    .from(job)
    .where(and(eq(job.id, id), eq(job.kind, "speech"), eq(job.status, "done")))
  if (!row?.audio || !row.linkSecret || !row.finishedAt) return null
  const a = createHash("sha256").update(row.linkSecret).digest()
  const b = createHash("sha256").update(secret).digest()
  if (!timingSafeEqual(a, b)) return null
  if (Date.now() - row.finishedAt.getTime() > RESULT_TTL_MS) return null
  return { audio: row.audio, mime: row.mime ?? "audio/mpeg" }
}

/** A finished speech job's audio, for the request that just waited on it. */
export async function speechAudioById(id: string) {
  const [row] = await db
    .select({ audio: job.result, mime: job.resultMime })
    .from(job)
    .where(and(eq(job.id, id), eq(job.status, "done")))
  return row?.audio
    ? { audio: row.audio, mime: row.mime ?? "audio/mpeg" }
    : null
}

/** Drops results past their time, so the table holds only a day of audio. */
export async function sweepResults() {
  await db
    .update(job)
    .set({ result: null })
    .where(
      and(
        sql`${job.result} is not null`,
        lt(job.finishedAt, new Date(Date.now() - RESULT_TTL_MS))
      )
    )
}
