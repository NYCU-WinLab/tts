import { PageHeader } from "@/components/page-header"
import { TtsShell } from "@/components/tts-shell"
import { runAction } from "@/lib/actions/define"
import { listApiKeys } from "@/lib/actions/keys"
import { requireActor } from "@/lib/auth/session"

import { KeyList, NewKey } from "./keys"

export const dynamic = "force-dynamic"

export default async function KeysPage() {
  const actor = await requireActor("/keys")
  const { keys } = await runAction(listApiKeys, actor, {})
  const base = process.env.BETTER_AUTH_URL ?? "https://tts.winlab.tw"
  return (
    <TtsShell page={{ label: "API 金鑰", href: "/keys", tip: "" }}>
      <div className="flex flex-col gap-12">
        <PageHeader title="API 金鑰" actions={<NewKey base={base} />} />
        <KeyList
          keys={keys.map((key) => ({
            ...key,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </TtsShell>
  )
}
