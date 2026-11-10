import { onChange } from "@/lib/actions/changes"
import { getSession } from "@/lib/auth/session"

// Server-sent events: one line per change anywhere in tts, so open
// pages can refresh. Signed-in members only; the payload is an action name.
export async function GET(request: Request) {
  if (!(await getSession())) return new Response(null, { status: 401 })

  const encoder = new TextEncoder()
  let stop = () => {}
  const stream = new ReadableStream({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          stop()
        }
      }
      send("retry: 3000\n\n")
      const off = await onChange((action) => send(`data: ${action}\n\n`))
      // Keeps proxies from closing a quiet connection.
      const ping = setInterval(() => send(": ping\n\n"), 25_000)
      stop = () => {
        clearInterval(ping)
        off()
      }
      request.signal.addEventListener("abort", () => {
        stop()
        try {
          controller.close()
        } catch {}
      })
    },
    cancel() {
      stop()
    },
  })
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  })
}
