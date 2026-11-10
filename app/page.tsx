import { PageHeader } from "@/components/page-header"
import { TtsShell } from "@/components/tts-shell"
import { runAction } from "@/lib/actions/define"
import { MAX_INPUT } from "@/lib/actions/speech"
import { listVoices } from "@/lib/actions/voices"
import { requireActor } from "@/lib/auth/session"

import { Speak } from "./speak"

export const dynamic = "force-dynamic"

export default async function Home() {
  const actor = await requireActor("/")
  const { voices } = await runAction(listVoices, actor, {})
  const ready = voices
    .filter((voice) => voice.status === "ready")
    .map((voice) => ({
      value: voice.builtin ? voice.name : voice.id,
      label:
        voice.mine || voice.builtin
          ? voice.name
          : `${voice.name}（${voice.owner}）`,
    }))
  return (
    <TtsShell>
      <div className="flex flex-col gap-12">
        <PageHeader title="語音合成" />
        <Speak voices={ready} maxInput={MAX_INPUT} />
      </div>
    </TtsShell>
  )
}
