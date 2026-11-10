import { runAction } from "@/lib/actions/define"
import { deleteVoice } from "@/lib/actions/voices"
import { withApiKey } from "@/lib/openai/http"

export const runtime = "nodejs"

// DELETE /v1/audio/voices/<id>: deletes one of the key's member's voices.
export async function DELETE(
  request: Request,
  { params }: RouteContext<"/v1/audio/voices/[id]">
) {
  return withApiKey(request, async (actor) => {
    const { id } = await params
    await runAction(deleteVoice, actor, { id })
    return Response.json({ id, object: "audio.voice.deleted", deleted: true })
  })
}
