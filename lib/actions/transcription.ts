import { z } from "zod"

import { defineAction } from "@/lib/actions/define"
import { eq, sql } from "drizzle-orm"

import {
  enqueue,
  speechAudioById,
  sweepTranscriptions,
  waitFor,
  workerOnline,
  type Transcript,
} from "@/lib/actions/jobs"
import { MAX_INPUT } from "@/lib/actions/speech"
import { audio, mime } from "@/lib/actions/voices"
import { db } from "@/lib/db"
import { job } from "@/lib/db/schema"

// Speech to text with the worker's Whisper. Made for checking generated
// speech: with the text it should say, the answer also scores the reading
// and lists where it differs, such as a character read the wrong way.

const MAX_PENDING = 3
const TRANSCRIBE_TIMEOUT_MS = 120_000

export const transcribe = defineAction({
  name: "transcribe",
  title: "語音轉文字",
  description:
    "Transcribes a recording (10 MB at most) with Whisper on the lab GPU. With expected, the text the recording should say, it also returns expected_score (0 to 1; pinyin with tones for Chinese) and the differences, so a mispronounced character in generated speech shows up.",
  kind: "mutation",
  input: z.object({
    recording: audio,
    mime,
    language: z
      .string()
      .trim()
      .regex(/^[a-z]{2}$/, "語言要用兩個字母，例如 zh 或 en")
      .optional(),
    expected: z.string().trim().max(MAX_INPUT).optional(),
  }),
  run: async (actor, input) => {
    if (!workerOnline()) throw new Error("語音主機離線，請稍後再試")
    await sweepTranscriptions()
    const id = await enqueue(
      {
        kind: "transcription",
        userId: actor.userId,
        params: {
          mime: input.mime,
          language: input.language ?? null,
          expected: input.expected || null,
        },
        via: actor.via,
        input: input.recording,
      },
      MAX_PENDING
    )
    if (!id) throw new Error("你已經有好幾件在排隊，請等它們完成")
    const done = await waitFor(id, TRANSCRIBE_TIMEOUT_MS)
    if (done.status === "failed")
      throw new Error(`轉文字失敗：${done.error ?? "原因不明"}`)
    const result = await speechAudioById(id)
    // Nothing of the recording is kept once the answer is read: the
    // transcript and the expected text go with it.
    await db
      .update(job)
      .set({ result: null, params: sql`${job.params} - 'expected'` })
      .where(eq(job.id, id))
    if (!result) throw new Error("轉文字的結果不見了")
    return JSON.parse(result.audio.toString("utf8")) as Transcript
  },
  mcpExcludedBecause:
    "It takes an audio file, which MCP clients cannot send; use /v1/audio/transcriptions.",
})
