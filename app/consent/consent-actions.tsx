"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

export function ConsentActions() {
  const [pending, setPending] = React.useState<"allow" | "deny" | null>(null)

  async function answer(accept: boolean) {
    setPending(accept ? "allow" : "deny")
    const { data, error } = await authClient.oauth2.consent({ accept })
    if (error || !data?.url) {
      setPending(null)
      toast.error(error?.message ?? "沒有回應")
      return
    }
    window.location.href = data.url
  }

  return (
    <div className="flex gap-3">
      <Button
        variant="outline"
        disabled={pending !== null}
        onClick={() => answer(false)}
      >
        {pending === "deny" ? "拒絕中…" : "拒絕"}
      </Button>
      <Button disabled={pending !== null} onClick={() => answer(true)}>
        {pending === "allow" ? "允許中…" : "允許"}
      </Button>
    </div>
  )
}
