import { TtsShell } from "@/components/tts-shell"
import { StatusPage } from "@/components/status-page"
import { getConsentRequest } from "@/lib/auth/consent"
import { requireActor } from "@/lib/auth/session"

import { ConsentActions } from "./consent-actions"

export const dynamic = "force-dynamic"

export default async function Consent({ searchParams }: PageProps<"/consent">) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of [value].flat())
      if (item !== undefined) params.append(key, item)
  }
  const query = params.toString()
  await requireActor(`/consent?${query}`)
  const request = await getConsentRequest(query)

  if (!request) {
    return (
      <TtsShell layout="spotlight">
        <StatusPage title="授權連結已失效" />
      </TtsShell>
    )
  }

  return (
    <TtsShell layout="spotlight">
      <StatusPage
        title={`允許 ${request.name}${request.host ? `（${request.host}）` : ""} 以你的身分操作？`}
        action={<ConsentActions />}
      />
    </TtsShell>
  )
}
