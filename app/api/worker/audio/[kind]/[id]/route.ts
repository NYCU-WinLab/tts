import { isWorker, workerAudio } from "@/lib/actions/jobs"

export const runtime = "nodejs"

// A voice's sample, a consent recording or a recording to transcribe, for
// the worker only.
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/worker/audio/[kind]/[id]">
) {
  if (!isWorker(request.headers.get("authorization")))
    return new Response(null, { status: 401 })
  const { kind, id } = await params
  if (kind !== "voice" && kind !== "consent" && kind !== "job")
    return new Response(null, { status: 404 })
  const found = await workerAudio(kind, id)
  if (!found) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(found.audio), {
    headers: { "content-type": found.mime },
  })
}
