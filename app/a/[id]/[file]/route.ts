import { speechAudio } from "@/lib/actions/jobs"

export const runtime = "nodejs"

// The link speak returns: /a/<job id>/<secret>.<format>. Works without
// signing in for a day, so an agent or a chat can play it.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/a/[id]/[file]">
) {
  const { id, file } = await params
  const secret = file.replace(/\.[a-z0-9]+$/, "")
  if (!/^[0-9a-f-]{36}$/.test(id) || !secret)
    return new Response(null, { status: 404 })
  const found = await speechAudio(id, secret)
  if (!found) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(found.audio), {
    headers: {
      "content-type": found.mime,
      "cache-control": "private, max-age=86400",
    },
  })
}
