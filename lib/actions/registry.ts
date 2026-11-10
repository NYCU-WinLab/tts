import type { Action } from "@/lib/actions/define"
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/actions/keys"
import {
  deleteSpeech,
  listSpeeches,
  myUsage,
  speak,
} from "@/lib/actions/speech"
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
  listSpeeches,
  deleteSpeech,
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
