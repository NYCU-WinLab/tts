import { runAction } from "@/lib/actions/define"
import { speechAudioById } from "@/lib/actions/jobs"
import { FORMATS, speak } from "@/lib/actions/speech"
import { openaiError, withApiKey } from "@/lib/openai/http"

export const runtime = "nodejs"

// POST /v1/audio/speech, as OpenAI: { model, input, voice, response_format,
// speed } returns the audio bytes. voice is a built-in's name ("cc"), a
// voice id, or { "id": "voice_..." }. model is accepted and ignored: there
// is one model, IndexTTS-2.
export async function POST(request: Request) {
  return withApiKey(request, async (actor) => {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!body) return openaiError(400, "Body must be JSON.")
    const voice =
      typeof body.voice === "object" && body.voice !== null
        ? (body.voice as { id?: unknown }).id
        : body.voice
    const format = body.response_format ?? "mp3"
    if (typeof format !== "string" || !(format in FORMATS))
      return openaiError(
        400,
        `response_format must be one of ${Object.keys(FORMATS).join(", ")}.`
      )
    const result = await runAction(speak, actor, {
      input: body.input,
      voice,
      format,
      speed: body.speed ?? 1,
    })
    const audio = await speechAudioById(result.id)
    if (!audio) return openaiError(500, "The audio is gone.", "server_error")
    return new Response(new Uint8Array(audio.audio), {
      headers: {
        "content-type": audio.mime,
        "x-audio-seconds": String(result.seconds ?? ""),
      },
    })
  })
}
