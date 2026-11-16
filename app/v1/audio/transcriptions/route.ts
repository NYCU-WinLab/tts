import { runAction } from "@/lib/actions/define"
import { transcribe } from "@/lib/actions/transcription"
import { fileField, openaiError, withApiKey } from "@/lib/openai/http"

export const runtime = "nodejs"

// POST /v1/audio/transcriptions (multipart: file, model, language,
// response_format), as OpenAI. model is accepted and ignored: it is Whisper
// large-v3. response_format is json (default), text or verbose_json.
// Extension: expected, the text the recording should say, adds
// expected_score and differences to the JSON.
export async function POST(request: Request) {
  return withApiKey(request, async (actor) => {
    const form = await request.formData().catch(() => null)
    if (!form) return openaiError(400, "Body must be multipart/form-data.")
    const format = String(form.get("response_format") ?? "json")
    if (!["json", "text", "verbose_json"].includes(format))
      return openaiError(
        400,
        "response_format must be one of json, text, verbose_json."
      )
    const file = await fileField(form, "file")
    const text = (name: string) => {
      const value = form.get(name)
      return typeof value === "string" && value.trim() ? value : undefined
    }
    const result = await runAction(transcribe, actor, {
      recording: file.bytes,
      mime: file.mime,
      language: text("language"),
      expected: text("expected"),
    })
    if (format === "text")
      return new Response(result.text, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    const extra = {
      ...(result.expected_score !== undefined && {
        expected_score: result.expected_score,
        differences: result.differences ?? [],
      }),
    }
    if (format === "verbose_json")
      return Response.json({
        task: "transcribe",
        language: result.language,
        duration: result.duration,
        text: result.text,
        ...extra,
      })
    return Response.json({ text: result.text, ...extra })
  })
}
