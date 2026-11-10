import { runAction } from "@/lib/actions/define"
import { createVoiceConsent, listVoiceConsents } from "@/lib/actions/voices"
import { fileField, openaiError, unixTime, withApiKey } from "@/lib/openai/http"

export const runtime = "nodejs"

type Consent = {
  id: string
  name: string
  language: string
  status: string
  transcript: string | null
  reason: string | null
  createdAt: Date
}

const shape = (consent: Consent) => ({
  id: consent.id,
  object: "audio.voice_consent",
  name: consent.name,
  language: consent.language,
  status: consent.status,
  transcript: consent.transcript,
  reason: consent.reason,
  created_at: unixTime(consent.createdAt),
})

// POST /v1/audio/voice_consents (multipart: name, language, recording), as
// OpenAI. The speaker reads the sentence for the language (GET lists them).
// Answers once the worker checked it: 200 verified, 400 rejected.
export async function POST(request: Request) {
  return withApiKey(request, async (actor) => {
    const form = await request.formData().catch(() => null)
    if (!form) return openaiError(400, "Body must be multipart/form-data.")
    const recording = await fileField(form, "recording")
    const consent = await runAction(createVoiceConsent, actor, {
      name: form.get("name") ?? "",
      language: form.get("language") ?? "zh",
      recording: recording.bytes,
      mime: recording.mime,
    })
    if (consent.status !== "verified")
      return openaiError(
        400,
        `Consent rejected: ${consent.reason ?? "unknown"} (heard: ${consent.transcript ?? ""})`,
        "invalid_request_error",
        "consent_rejected"
      )
    return Response.json(shape(consent))
  })
}

export async function GET(request: Request) {
  return withApiKey(request, async (actor) => {
    const { consents, sentences } = await runAction(
      listVoiceConsents,
      actor,
      {}
    )
    return Response.json({
      object: "list",
      data: consents.map(shape),
      sentences,
    })
  })
}
