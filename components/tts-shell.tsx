import { AppShell } from "@/components/app-shell"
import { LiveRefresh } from "@/components/live-refresh"
import { getSession } from "@/lib/auth/session"
import { runningBuild } from "@/lib/build"

// TTS's corners: the lab and the page in the breadcrumb, the pages in the
// top right (登入 when signed out), the build in the bottom left.
export async function TtsShell({
  page,
  layout,
  children,
}: {
  page?: { label: string; href: string; tip: string }
  layout?: "column" | "spotlight" | "wide"
  children: React.ReactNode
}) {
  const session = await getSession()
  return (
    <AppShell
      layout={layout}
      breadcrumb={[
        { label: "WinLab", href: "https://portal.winlab.tw", tip: "" },
        { label: "TTS", href: "/", tip: "" },
        ...(page ? [page] : []),
      ]}
      build={runningBuild()}
      nav={
        session
          ? [
              { label: "聲音", href: "/voices", tip: "" },
              { label: "API 金鑰", href: "/keys", tip: "" },
            ]
          : []
      }
      account={
        session ? undefined : { label: "登入", href: "/sign-in", tip: "" }
      }
    >
      {session && <LiveRefresh />}
      {children}
    </AppShell>
  )
}
