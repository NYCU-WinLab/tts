import { PageHeader } from "@/components/page-header"
import { TtsShell } from "@/components/tts-shell"
import { runAction } from "@/lib/actions/define"
import { CONSENT_SENTENCES, listVoices } from "@/lib/actions/voices"
import { requireActor } from "@/lib/auth/session"

import { NewVoice } from "./new-voice"
import { VoiceList } from "./voice-list"

export const dynamic = "force-dynamic"

export default async function VoicesPage() {
  const actor = await requireActor("/voices")
  const { voices } = await runAction(listVoices, actor, {})
  return (
    <TtsShell page={{ label: "聲音", href: "/voices", tip: "" }}>
      <div className="flex flex-col gap-12">
        <PageHeader
          title="聲音"
          actions={
            <NewVoice
              sentences={CONSENT_SENTENCES}
              again={voices.some((voice) => voice.mine)}
            />
          }
        />
        <VoiceList
          voices={voices.map((voice) => ({
            ...voice,
            createdAt: voice.createdAt.toISOString(),
          }))}
        />
      </div>
    </TtsShell>
  )
}
