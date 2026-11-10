import { withApiKey } from "@/lib/openai/http"

// GET /v1/models: the one model, so OpenAI clients that list models find it.
export async function GET(request: Request) {
  return withApiKey(request, async () =>
    Response.json({
      object: "list",
      data: [
        { id: "indextts-2", object: "model", created: 0, owned_by: "winlab" },
      ],
    })
  )
}
