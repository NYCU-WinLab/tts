import type { Action } from "@/lib/actions/define"
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/actions/keys"
import { myUsage, speak } from "@/lib/actions/speech"
import { whoami } from "@/lib/actions/users"
import {
  createVoice,
  createVoiceConsent,
  deleteVoice,
  listVoiceConsents,
  listVoices,
  shareVoice,
} from "@/lib/actions/voices"

/** Every action, in the order MCP lists them. */
export const actions: Action[] = [
  whoami,
  listVoices,
  speak,
  shareVoice,
  deleteVoice,
  listVoiceConsents,
  createVoiceConsent,
  createVoice,
  myUsage,
  listApiKeys,
  createApiKey,
  revokeApiKey,
]
