import { z } from "zod"

import type { Actor } from "@/lib/actions/define"
import { errorMessage } from "@/lib/actions/define"
import { actorFromApiKey } from "@/lib/actions/keys"

// The OpenAI-style /v1 endpoints: a bearer API key from /keys, JSON errors
// shaped like OpenAI's so its SDKs show the message.

export function openaiError(
  status: number,
  message: string,
  type = "invalid_request_error",
  code: string | null = null
) {
  return Response.json(
    { error: { message, type, param: null, code } },
    { status }
  )
}

/** Runs handler as the key's member, turning failures into OpenAI errors. */
export async function withApiKey(
  request: Request,
  handler: (actor: Actor) => Promise<Response>
) {
  const actor = await actorFromApiKey(request.headers.get("authorization"))
  if (!actor)
    return openaiError(
      401,
      "Missing or invalid API key. Make one at https://tts.winlab.tw/keys.",
      "invalid_request_error",
      "invalid_api_key"
    )
  try {
    return await handler(actor)
  } catch (error) {
    const message = errorMessage(error)
    if (message.includes("離線"))
      return openaiError(503, message, "server_error")
    if (message.includes("逾時"))
      return openaiError(504, message, "server_error")
    if (message.includes("排隊"))
      return openaiError(429, message, "rate_limit_error")
    return openaiError(400, message)
  }
}

/** A multipart file field as bytes and type. */
export async function fileField(form: FormData, name: string) {
  const value = form.get(name)
  if (!(value instanceof File))
    throw new z.ZodError([
      { code: "custom", path: [name], message: `請附上 ${name} 檔案` },
    ])
  return {
    bytes: Buffer.from(await value.arrayBuffer()),
    mime: value.type || "application/octet-stream",
  }
}

export const unixTime = (date: Date | string) =>
  Math.floor(new Date(date).getTime() / 1000)
