import { claimNext, isWorker, sweepResults } from "@/lib/actions/jobs"

export const runtime = "nodejs"

// The GPU worker long-polls here for its next job with WORKER_TOKEN. 204
// means nothing came within the wait; poll again.
export async function GET(request: Request) {
  if (!isWorker(request.headers.get("authorization")))
    return new Response(null, { status: 401 })
  const name = request.headers.get("x-worker") ?? "worker"
  const next = await claimNext(name, 25_000)
  if (!next) {
    await sweepResults().catch(() => {})
    return new Response(null, { status: 204 })
  }
  return Response.json(next)
}
