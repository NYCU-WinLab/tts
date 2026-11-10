import { runAction } from "@/lib/actions/define"
import { createVoice, listVoices } from "@/lib/actions/voices"
import { fileField, openaiError, unixTime, withApiKey } from "@/lib/openai/http"

export const runtime = "nodejs"

// POST /v1/audio/voices (multipart: name, audio_sample, consent), as OpenAI.
// Answers once the worker compared the sample with the consent's speaker.
// Admins may send builtin=true and consent_note instead of consent.
export async function POST(request: Request) {
  return withApiKey(request, async (actor) => {
    const form = await request.formData().catch(() => null)
    if (!form) return openaiError(400, "Body must be multipart/form-data.")
    const sample = await fileField(form, "audio_sample")
    const made = await runAction(createVoice, actor, {
      name: form.get("name") ?? "",
      sample: sample.bytes,
      mime: sample.mime,
      consent: form.get("consent") ?? undefined,
      builtin: form.get("builtin") === "true",
      consentNote: form.get("consent_note") ?? undefined,
    })
    if (made.status !== "ready")
      return openaiError(
        400,
        `Voice rejected: ${made.reason ?? "unknown"}`,
        "invalid_request_error",
        "voice_rejected"
      )
    return Response.json({
      id: made.id,
      object: "audio.voice",
      name: made.name,
      created_at: unixTime(new Date()),
    })
  })
}

// GET /v1/audio/voices: the voices this key's member can speak in.
export async function GET(request: Request) {
  return withApiKey(request, async (actor) => {
    const { voices } = await runAction(listVoices, actor, {})
    return Response.json({
      object: "list",
      data: voices.map((voice) => ({
        id: voice.id,
        object: "audio.voice",
        name: voice.name,
        builtin: voice.builtin,
        shared: voice.shared,
        mine: voice.mine,
        owner: voice.owner,
        status: voice.status,
        created_at: unixTime(voice.createdAt),
      })),
    })
  })
}
