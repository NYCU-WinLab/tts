import { PageHeader } from "@/components/page-header"
import { TtsShell } from "@/components/tts-shell"
import { runAction } from "@/lib/actions/define"
import { listSpeeches, MAX_INPUT } from "@/lib/actions/speech"
import { listVoices } from "@/lib/actions/voices"
import { requireActor } from "@/lib/auth/session"

import { History } from "./history"
import { Speak } from "./speak"

export const dynamic = "force-dynamic"

export default async function Home() {
  const actor = await requireActor("/")
  const [{ voices }, { speeches }] = await Promise.all([
    runAction(listVoices, actor, {}),
    runAction(listSpeeches, actor, { limit: 200 }),
  ])
  const ready = voices
    .filter((voice) => voice.status === "ready")
    .map((voice) => ({ value: voice.id, label: voice.owner }))
  return (
    <TtsShell>
      <div className="flex flex-col gap-12">
        <PageHeader title="語音合成" />
        <Speak voices={ready} maxInput={MAX_INPUT} />
        <History
          speeches={speeches.map((speech) => ({
            id: speech.id,
            input: speech.input,
            voice: speech.voice,
            seconds: speech.seconds,
            createdAt: speech.createdAt.toISOString(),
          }))}
        />
      </div>
    </TtsShell>
  )
}
