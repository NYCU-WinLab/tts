"use client"

import * as React from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { deleteVoiceAction, shareVoiceAction } from "../actions"

type Voice = {
  id: string
  name: string
  builtin: boolean
  shared: boolean
  status: string
  reason: string | null
  owner: string
  mine: boolean
}

const STATUS: Record<string, string> = {
  ready: "可用",
  pending: "檢查中",
  rejected: "未通過",
}

export function VoiceList({ voices }: { voices: Voice[] }) {
  const [pending, start] = React.useTransition()
  if (!voices.length) return <EmptyState noun="聲音" />

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await fn()
      if (!result.ok) toast.error(result.error)
    })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名稱</TableHead>
          <TableHead>擁有者</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {voices.map((voice) => (
          <TableRow key={voice.id}>
            <TableCell className="font-medium">
              {voice.name}
              {voice.builtin && (
                <span className="ml-2 text-muted-foreground">內建</span>
              )}
            </TableCell>
            <TableCell>{voice.owner}</TableCell>
            <TableCell>
              {voice.status === "rejected"
                ? `${STATUS.rejected}：${voice.reason ?? ""}`
                : (STATUS[voice.status] ?? voice.status)}
              {voice.mine && voice.shared && !voice.builtin && "、已分享"}
            </TableCell>
            <TableCell className="text-right">
              {voice.mine && !voice.builtin && (
                <div className="flex justify-end gap-2">
                  {voice.status === "ready" && (
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() => shareVoiceAction(voice.id, !voice.shared))
                      }
                    >
                      {voice.shared ? "取消分享" : "分享"}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`刪除「${voice.name}」？錄音會一起刪掉。`))
                        run(() => deleteVoiceAction(voice.id))
                    }}
                  >
                    刪除
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
