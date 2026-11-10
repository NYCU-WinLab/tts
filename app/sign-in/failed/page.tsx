import Link from "next/link"

import { TtsShell } from "@/components/tts-shell"
import { StatusPage } from "@/components/status-page"
import { buttonVariants } from "@/components/ui/button"

export default function SignInFailed() {
  return (
    <TtsShell layout="spotlight">
      <StatusPage
        title="登入失敗"
        action={
          <Link href="/sign-in" className={buttonVariants()}>
            重試
          </Link>
        }
      />
    </TtsShell>
  )
}
