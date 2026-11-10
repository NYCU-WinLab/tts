import { finishJob, isWorker, type JobReport } from "@/lib/actions/jobs"

export const runtime = "nodejs"

// The worker reports a job: speech as the audio bytes (content-type audio/*,
// x-audio-seconds), a check or a failure as JSON.
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/worker/jobs/[id]">
) {
  if (!isWorker(request.headers.get("authorization")))
    return new Response(null, { status: 401 })
  const { id } = await params
  const type = request.headers.get("content-type") ?? ""
  let report: JobReport
  if (type.startsWith("audio/")) {
    report = {
      kind: "speech",
      audio: Buffer.from(await request.arrayBuffer()),
      mime: type,
      seconds: Number(request.headers.get("x-audio-seconds") ?? 0),
    }
  } else {
    report = (await request.json()) as JobReport
  }
  const ok = await finishJob(id, report)
  return new Response(null, { status: ok ? 204 : 409 })
}
