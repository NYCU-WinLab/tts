"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { deleteSpeechAction } from "./actions"

type Speech = {
  id: string
  input: string
  voice: string
  seconds: number | null
  createdAt: string
}

const time = new Intl.DateTimeFormat("zh-TW", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Taipei",
})

// Every speech the member made, newest first: what it says and its audio.
export function History({ speeches }: { speeches: Speech[] }) {
  const [pending, start] = React.useTransition()
  // A speech that shows up on top after the page loaded was just made: play it.
  const [first] = React.useState(speeches[0]?.id)
  if (!speeches.length) return null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title">紀錄</h2>
      <ul className="flex flex-col divide-y divide-border">
        {speeches.map((speech, index) => (
          <li key={speech.id} className="flex flex-col gap-2 py-4">
            <p className="break-words whitespace-pre-wrap">{speech.input}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              <span>{speech.voice}</span>
              <span className="tabular-nums">
                {time.format(new Date(speech.createdAt))}
              </span>
              {speech.seconds != null && (
                <span className="tabular-nums">
                  {speech.seconds.toFixed(1)} 秒
                </span>
              )}
              <Button
                variant="ghost"
                className="ml-auto"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await deleteSpeechAction(speech.id)
                    if (!result.ok) toast.error(result.error)
                  })
                }
              >
                刪除
              </Button>
            </div>
            <audio
              src={`/speeches/${speech.id}`}
              controls
              preload="none"
              autoPlay={index === 0 && speech.id !== first}
              className="w-full"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
