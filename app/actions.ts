"use server"

import { errorMessage, runAction } from "@/lib/actions/define"
import { createApiKey, revokeApiKey } from "@/lib/actions/keys"
import { speak } from "@/lib/actions/speech"
import {
  createVoice,
  createVoiceConsent,
  deleteVoice,
  shareVoice,
} from "@/lib/actions/voices"
import { requireActor } from "@/lib/auth/session"

// The writes a page makes, each one an action run as the signed-in member.
// Errors come back as a message for a toast, never thrown into the page.
type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

async function attempt<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, ...(await fn()) } as Result<T>
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) }
  }
}

export async function speakAction(input: string, voice: string) {
  const actor = await requireActor("/")
  return attempt(() => runAction(speak, actor, { input, voice, format: "mp3" }))
}

/** Both recordings from the browser recorder: the consent sentence, then the
 * sample. Makes the consent, then the voice from it. */
export async function createVoiceAction(data: FormData) {
  const actor = await requireActor("/voices")
  return attempt(async () => {
    const consentFile = data.get("consent")
    const sampleFile = data.get("sample")
    if (!(consentFile instanceof File) || !(sampleFile instanceof File))
      throw new Error("請錄好兩段錄音")
    const name = String(data.get("name") ?? "")
    const consent = await runAction(createVoiceConsent, actor, {
      name,
      language: String(data.get("language") ?? "zh"),
      recording: Buffer.from(await consentFile.arrayBuffer()),
      mime: consentFile.type,
    })
    if (consent.status !== "verified")
      throw new Error(
        `同意錄音沒通過：${consent.reason ?? ""}（聽到「${consent.transcript ?? ""}」）`
      )
    const made = await runAction(createVoice, actor, {
      name,
      consent: consent.id,
      sample: Buffer.from(await sampleFile.arrayBuffer()),
      mime: sampleFile.type,
    })
    if (made.status !== "ready")
      throw new Error(`聲音樣本沒通過：${made.reason ?? ""}`)
    return { id: made.id }
  })
}

export async function shareVoiceAction(id: string, shared: boolean) {
  const actor = await requireActor("/voices")
  return attempt(() => runAction(shareVoice, actor, { id, shared }))
}

export async function deleteVoiceAction(id: string) {
  const actor = await requireActor("/voices")
  return attempt(() => runAction(deleteVoice, actor, { id }))
}

export async function createApiKeyAction(name: string) {
  const actor = await requireActor("/keys")
  return attempt(() => runAction(createApiKey, actor, { name }))
}

export async function revokeApiKeyAction(id: string) {
  const actor = await requireActor("/keys")
  return attempt(() => runAction(revokeApiKey, actor, { id }))
}
