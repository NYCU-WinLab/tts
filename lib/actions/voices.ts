import { randomBytes } from "node:crypto"

import { and, desc, eq, or, sql } from "drizzle-orm"
import { z } from "zod"

import { type Actor, defineAction } from "@/lib/actions/define"
import { enqueue, waitFor, workerOnline } from "@/lib/actions/jobs"
import { db } from "@/lib/db"
import { account, job, user, voice, voiceConsent } from "@/lib/db/schema"
import { findKeycloakUserByUsername } from "@/lib/keycloak"

// Voices: each member has one, their own, named after their lab account.
// A member makes it from a consent recording and a sample of the same
// speaker, which the worker checks; an admin may instead make one for a
// member with a note of how the speaker agreed (builtin). The owner decides
// whether every member may speak in it (shared).

/** What the speaker reads in the consent recording, per language. */
export const CONSENT_SENTENCES = {
  zh: "我是這個聲音的擁有者，我同意 WinLab 用這個聲音建立語音合成模型。",
  en: "I am the owner of this voice and I consent to WinLab using this voice to create a synthetic voice model.",
} as const
export type ConsentLanguage = keyof typeof CONSENT_SENTENCES

const MAX_CONSENTS = 20
const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const CHECK_TIMEOUT_MS = 120_000
const MAX_PENDING = 3

/** The audio types the OpenAI API takes, plus what browsers record. */
const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "video/webm",
  "video/mp4",
]

const audio = z.custom<Buffer>(
  (value) =>
    Buffer.isBuffer(value) &&
    value.length > 0 &&
    value.length <= MAX_AUDIO_BYTES,
  "錄音要小於 10 MB"
)
const mime = z
  .string()
  .transform((value) => value.split(";")[0].trim().toLowerCase())
  .refine((value) => AUDIO_TYPES.includes(value), "不支援這種音檔格式")

const newId = (prefix: string) => `${prefix}_${randomBytes(12).toString("hex")}`

async function usernameOf(userId: string) {
  const [row] = await db
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, userId))
  return row?.username ?? null
}

async function nameOf(userId: string) {
  const [row] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
  return row?.name ?? ""
}

/** The member with this lab account name. One who never signed in here gets
 * their user and Keycloak link now, from Keycloak, so their first sign-in
 * lands on the same user and finds the voice made for them. */
async function memberByUsername(username: string) {
  const [known] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.username, username))
  if (known) return known
  const found = await findKeycloakUserByUsername(username)
  if (!found?.enabled || !found.email)
    throw new Error(`找不到成員「${username}」`)
  const name =
    found.attributes?.chinese_name?.[0]?.trim() ||
    [found.firstName, found.lastName].filter(Boolean).join(" ").trim() ||
    found.username
  return db.transaction(async (tx) => {
    const [made] = await tx
      .insert(user)
      .values({
        name,
        email: found.email!.toLowerCase(),
        emailVerified: true,
        username: found.username,
        updatedAt: new Date(),
      })
      .returning({ id: user.id, name: user.name })
    await tx.insert(account).values({
      accountId: found.id,
      providerId: "keycloak",
      userId: made.id,
      updatedAt: new Date(),
    })
    return made
  })
}

/** A member's voice that just passed replaces the ones they had. */
async function replaceOlder(userId: string, keep: string) {
  await db
    .delete(voice)
    .where(and(eq(voice.userId, userId), sql`${voice.id} <> ${keep}`))
}

export async function isAdmin(actor: Actor) {
  if (!actor.userId) return false
  const username = await usernameOf(actor.userId)
  const admins = (process.env.TTS_ADMINS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  return !!username && admins.includes(username)
}

/** Queues a check; a member waits on at most a few jobs at a time. */
async function queueCheck(values: Parameters<typeof enqueue>[0]) {
  const jobId = await enqueue(values, MAX_PENDING)
  if (jobId) return jobId
  // Refused: drop the consent or voice just added for this check.
  if (typeof values.params.consentId === "string" && values.kind === "consent")
    await db
      .delete(voiceConsent)
      .where(eq(voiceConsent.id, values.params.consentId))
  if (typeof values.params.voiceId === "string")
    await db.delete(voice).where(eq(voice.id, values.params.voiceId))
  throw new Error("你已經有好幾件在排隊，請等它們完成")
}

function requireWorker() {
  if (!workerOnline()) throw new Error("語音主機離線，請稍後再試")
}

export const listVoices = defineAction({
  name: "list_voices",
  title: "聲音列表",
  description:
    "Voices the signed-in member can speak in: every member's shared voice and the member's own, including one still being checked (status pending) or rejected (with the reason). Each member has one voice, named after them; pass its owner's lab account name (username, such as cctseng) or its id as voice to speak.",
  kind: "query",
  input: z.object({}),
  run: async (actor) => {
    const rows = await db
      .select({
        id: voice.id,
        name: voice.name,
        builtin: voice.builtin,
        shared: voice.shared,
        status: voice.status,
        reason: voice.reason,
        similarity: voice.similarity,
        createdAt: voice.createdAt,
        ownerId: voice.userId,
        owner: user.name,
        username: user.username,
      })
      .from(voice)
      .innerJoin(user, eq(user.id, voice.userId))
      .where(
        or(
          eq(voice.userId, actor.userId),
          and(eq(voice.shared, true), eq(voice.status, "ready"))
        )
      )
      .orderBy(desc(voice.createdAt))
    return {
      voices: rows.map(({ ownerId, ...row }) => ({
        ...row,
        mine: ownerId === actor.userId,
      })),
    }
  },
})

export const shareVoice = defineAction({
  name: "share_voice",
  title: "分享聲音",
  description:
    "Shares the signed-in member's own voice with every lab member (shared true), or makes it private again (shared false).",
  kind: "mutation",
  input: z.object({ id: z.string().min(1), shared: z.boolean() }),
  run: async (actor, input) => {
    const updated = await db
      .update(voice)
      .set({ shared: input.shared })
      .where(and(eq(voice.id, input.id), eq(voice.userId, actor.userId)))
      .returning({ id: voice.id })
    if (!updated.length) throw new Error("找不到你的這個聲音")
    return { id: input.id, shared: input.shared }
  },
})

export const deleteVoice = defineAction({
  name: "delete_voice",
  title: "刪除聲音",
  description:
    "Deletes the signed-in member's own voice and its recorded sample for good. An admin may delete a voice an admin made.",
  kind: "mutation",
  input: z.object({ id: z.string().min(1) }),
  run: async (actor, input) => {
    const admin = await isAdmin(actor)
    const deleted = await db
      .delete(voice)
      .where(
        and(
          eq(voice.id, input.id),
          admin
            ? or(eq(voice.userId, actor.userId), eq(voice.builtin, true))
            : eq(voice.userId, actor.userId)
        )
      )
      .returning({ id: voice.id })
    if (!deleted.length) throw new Error("找不到你的這個聲音")
    // Speech still queued in this voice would find no sample: end it now.
    await db
      .update(job)
      .set({ status: "failed", error: "voice deleted", finishedAt: new Date() })
      .where(
        and(
          eq(job.status, "queued"),
          sql`${job.params}->>'voiceId' = ${input.id}`
        )
      )
    return { id: input.id }
  },
})

export const listVoiceConsents = defineAction({
  name: "list_voice_consents",
  title: "同意錄音",
  description:
    "The signed-in member's consent recordings: id, name, language, status (pending, verified or rejected), what the check heard and why one was rejected. A verified consent makes voices of that speaker.",
  kind: "query",
  input: z.object({}),
  run: async (actor) => {
    const consents = await db
      .select({
        id: voiceConsent.id,
        name: voiceConsent.name,
        language: voiceConsent.language,
        status: voiceConsent.status,
        transcript: voiceConsent.transcript,
        reason: voiceConsent.reason,
        createdAt: voiceConsent.createdAt,
      })
      .from(voiceConsent)
      .where(eq(voiceConsent.userId, actor.userId))
      .orderBy(desc(voiceConsent.createdAt))
    return { consents, sentences: CONSENT_SENTENCES }
  },
})

export const createVoiceConsent = defineAction({
  name: "create_voice_consent",
  title: "上傳同意錄音",
  description:
    "Uploads a consent recording in which the speaker reads the fixed sentence for its language, then waits while the worker transcribes it. Returns the consent with status verified or rejected.",
  kind: "mutation",
  input: z.object({
    language: z.enum(["zh", "en"]),
    recording: audio,
    mime,
  }),
  run: async (actor, input) => {
    requireWorker()
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(voiceConsent)
      .where(eq(voiceConsent.userId, actor.userId))
    if (n >= MAX_CONSENTS) throw new Error(`最多 ${MAX_CONSENTS} 份同意錄音`)
    const id = newId("cons")
    await db.insert(voiceConsent).values({
      id,
      userId: actor.userId,
      name: await nameOf(actor.userId),
      language: input.language,
      recording: input.recording,
      mime: input.mime,
    })
    const jobId = await queueCheck({
      kind: "consent",
      userId: actor.userId,
      params: {
        consentId: id,
        language: input.language,
        sentence: CONSENT_SENTENCES[input.language],
      },
      via: actor.via,
    })
    await waitFor(jobId, CHECK_TIMEOUT_MS)
    const [row] = await db
      .select({
        id: voiceConsent.id,
        name: voiceConsent.name,
        language: voiceConsent.language,
        status: voiceConsent.status,
        transcript: voiceConsent.transcript,
        reason: voiceConsent.reason,
        createdAt: voiceConsent.createdAt,
      })
      .from(voiceConsent)
      .where(eq(voiceConsent.id, id))
    return row
  },
  mcpExcludedBecause:
    "It takes a recording of the member's own voice, made in the browser recorder or sent to /v1/audio/voice_consents.",
})

export const createVoice = defineAction({
  name: "create_voice",
  title: "建立聲音",
  description:
    "Makes the signed-in member's voice from a sample of up to 60 seconds and a verified consent of the same speaker; the worker compares the two speakers. It is named after the member and replaces the voice they had once it passes. An admin may instead make the voice of another member (owner, their lab account name), with a consent note saying how the speaker agreed, and share it.",
  kind: "mutation",
  input: z.object({
    sample: audio,
    mime,
    consent: z.string().optional(),
    owner: z.string().trim().min(1).max(60).optional(),
    consentNote: z.string().trim().max(500).optional(),
    shared: z.boolean().default(false),
  }),
  run: async (actor, input) => {
    const id = newId("voice")
    if (input.owner) {
      if (!(await isAdmin(actor)))
        throw new Error("只有管理員能替其他成員建立聲音")
      if (!input.consentNote) throw new Error("請寫明說話者怎麼同意的")
      requireWorker()
      const owner = await memberByUsername(input.owner)
      await db.insert(voice).values({
        id,
        userId: owner.id,
        name: owner.name,
        builtin: true,
        shared: input.shared,
        consentNote: input.consentNote,
        sample: input.sample,
        mime: input.mime,
      })
      // No consent to compare: the worker only checks the length and keeps
      // the speaker embedding, so other members cannot copy this voice.
      const jobId = await queueCheck({
        kind: "voice",
        userId: actor.userId,
        params: { voiceId: id },
        via: actor.via,
      })
      await waitFor(jobId, CHECK_TIMEOUT_MS)
      const [row] = await db
        .select({ status: voice.status, reason: voice.reason })
        .from(voice)
        .where(eq(voice.id, id))
      if (row?.status === "ready") await replaceOlder(owner.id, id)
      return { id, name: owner.name, ...row }
    }

    requireWorker()
    if (!input.consent) throw new Error("請附上同意錄音")
    const [consent] = await db
      .select({ status: voiceConsent.status })
      .from(voiceConsent)
      .where(
        and(
          eq(voiceConsent.id, input.consent),
          eq(voiceConsent.userId, actor.userId)
        )
      )
    if (!consent) throw new Error("找不到你的這份同意錄音")
    if (consent.status !== "verified")
      throw new Error("這份同意錄音沒有通過檢查")

    const name = await nameOf(actor.userId)
    await db.insert(voice).values({
      id,
      userId: actor.userId,
      name,
      consentId: input.consent,
      shared: input.shared,
      sample: input.sample,
      mime: input.mime,
    })
    const jobId = await queueCheck({
      kind: "voice",
      userId: actor.userId,
      params: { voiceId: id, consentId: input.consent },
      via: actor.via,
    })
    await waitFor(jobId, CHECK_TIMEOUT_MS)
    const [row] = await db
      .select({ status: voice.status, reason: voice.reason })
      .from(voice)
      .where(eq(voice.id, id))
    if (row?.status === "ready") await replaceOlder(actor.userId, id)
    return { id, name, ...row }
  },
  mcpExcludedBecause:
    "It takes a recording of the member's own voice, made in the browser recorder or sent to /v1/audio/voices.",
})

/** The ready voice a speech request names, if the member may use it: its
 * owner's lab account name (cctseng), or a voice id. */
export async function resolveVoice(actor: Actor, ref: string) {
  const byId = ref.startsWith("voice_")
  const [row] = await db
    .select({ id: voice.id, name: voice.name })
    .from(voice)
    .innerJoin(user, eq(user.id, voice.userId))
    .where(
      and(
        byId ? eq(voice.id, ref) : eq(user.username, ref.toLowerCase()),
        eq(voice.status, "ready"),
        or(eq(voice.shared, true), eq(voice.userId, actor.userId))
      )
    )
    .orderBy(desc(voice.createdAt))
    .limit(1)
  return row ?? null
}
