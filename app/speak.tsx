"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { speakAction } from "./actions"

type Option = { value: string; label: string }

// Text in, voice picked, audio out: the one thing the home page does.
export function Speak({
  voices,
  maxInput,
}: {
  voices: Option[]
  maxInput: number
}) {
  const [voice, setVoice] = React.useState(voices[0]?.value ?? "")
  const [text, setText] = React.useState("")
  const [pending, start] = React.useTransition()
  const router = useRouter()

  if (!voices.length) return <EmptyState noun="可用的聲音" />

  function submit(event: React.FormEvent) {
    event.preventDefault()
    start(async () => {
      const result = await speakAction(text, voice)
      if (!result.ok) return void toast.error(result.error)
      // The history below picks it up and plays it.
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Textarea
        aria-label="文字"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={maxInput}
        rows={6}
        placeholder="輸入要念的文字"
        disabled={pending}
      />
      <div className="flex items-center gap-4">
        <Select
          value={voice}
          onValueChange={(value) => setVoice(String(value))}
          items={voices}
        >
          <SelectTrigger aria-label="聲音" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {voices.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground tabular-nums">
          {[...text].length} / {maxInput}
        </span>
        <Button
          type="submit"
          className="ml-auto"
          disabled={pending || !text.trim()}
        >
          {pending ? "產生中…" : "產生"}
        </Button>
      </div>
    </form>
  )
}
