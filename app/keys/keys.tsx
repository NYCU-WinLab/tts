"use client"

import * as React from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/empty-state"
import { FormDialog, FormField } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { createApiKeyAction, revokeApiKeyAction } from "../actions"

type Key = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("zh-TW", { hour12: false }) : "沒用過"

export function NewKey({ base }: { base: string }) {
  const [made, setMade] = React.useState<string>()

  async function submit(data: FormData) {
    const result = await createApiKeyAction(String(data.get("name") ?? ""))
    if (!result.ok) {
      toast.error(result.error)
      throw new Error(result.error)
    }
    setMade(result.key)
  }

  const example = made
    ? `curl ${base}/v1/audio/speech \\
  -H "Authorization: Bearer ${made}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "indextts-2", "input": "大家好", "voice": "cc"}' \\
  -o speech.mp3`
    : ""

  return (
    <>
      <FormDialog
        trigger={<Button>建立金鑰</Button>}
        title="建立 API 金鑰"
        submitLabel="建立"
        onSubmit={submit}
      >
        <FormField label="名稱" required>
          <Input name="name" maxLength={60} />
        </FormField>
      </FormDialog>
      <Dialog
        open={!!made}
        onOpenChange={(open) => !open && setMade(undefined)}
      >
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>新金鑰</DialogTitle>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-control bg-muted p-4 font-mono">
            {made}
          </pre>
          <pre className="overflow-x-auto rounded-control bg-muted p-4 font-mono">
            {example}
          </pre>
          <DialogFooter>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(made ?? "")
                toast.success("已複製")
              }}
            >
              複製金鑰
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function KeyList({ keys }: { keys: Key[] }) {
  const [pending, start] = React.useTransition()
  if (!keys.length) return <EmptyState noun="API 金鑰" />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名稱</TableHead>
          <TableHead>金鑰</TableHead>
          <TableHead>最後使用</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key.id}>
            <TableCell className="font-medium">{key.name}</TableCell>
            <TableCell className="font-mono">{key.prefix}…</TableCell>
            <TableCell>{date(key.lastUsedAt)}</TableCell>
            <TableCell className="text-right">
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`撤銷「${key.name}」？`)) return
                  start(async () => {
                    const result = await revokeApiKeyAction(key.id)
                    if (!result.ok) toast.error(result.error)
                  })
                }}
              >
                撤銷
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
