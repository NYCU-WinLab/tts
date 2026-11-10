import { ownSpeechAudio } from "@/lib/actions/jobs"
import { getSession } from "@/lib/auth/session"

export const runtime = "nodejs"

// A speech from the member's history, for the signed-in member who made it.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/speeches/[id]">
) {
  const session = await getSession()
  if (!session) return new Response(null, { status: 401 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 })
  const found = await ownSpeechAudio(session.user.id, id)
  if (!found) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(found.audio), {
    headers: {
      "content-type": found.mime,
      "cache-control": "private, max-age=86400",
    },
  })
}
