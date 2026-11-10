"use client"

import * as React from "react"
import { toast } from "sonner"

import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import { createVoiceAction } from "../actions"

type Language = "zh" | "en"

// A paragraph to read for the sample, so nobody has to think of one.
const SAMPLE_TEXT: Record<Language, string> = {
  zh: "今天天氣不錯，我們下午在實驗室討論新的實驗設計。請大家先把上週的結果整理好，有問題可以隨時提出來，我們一起看看怎麼改進。",
  en: "The weather is nice today. This afternoon we will meet in the lab to discuss the new experiment. Please bring last week's results, and raise any questions you have.",
}

// Records the member's own voice in one form: the consent sentence read
// aloud, then a sample of 10 to 60 seconds. The server checks both; the
// voice takes the member's name and replaces the one they had.
export function NewVoice({
  sentences,
  again,
}: {
  sentences: Record<Language, string>
  again: boolean
}) {
  const [language, setLanguage] = React.useState<Language>("zh")
  const [consent, setConsent] = React.useState<Blob>()
  const [sample, setSample] = React.useState<Blob>()

  async function submit(data: FormData) {
    if (!consent || !sample) {
      toast.error("請錄好兩段錄音")
      throw new Error("missing recordings")
    }
    data.set("language", language)
    data.set(
      "consent",
      new File([consent], "consent.webm", { type: consent.type })
    )
    data.set("sample", new File([sample], "sample.webm", { type: sample.type }))
    const result = await createVoiceAction(data)
    if (!result.ok) {
      toast.error(result.error)
      throw new Error(result.error)
    }
    toast.success(again ? "聲音換好了" : "聲音建好了")
    setConsent(undefined)
    setSample(undefined)
  }

  return (
    <FormDialog
      trigger={<Button>{again ? "重錄我的聲音" : "錄我的聲音"}</Button>}
      title={again ? "重錄我的聲音" : "錄我的聲音"}
      size="wide"
      submitLabel="建立"
      pendingLabel="檢查錄音中…"
      onSubmit={submit}
    >
      <div className="flex gap-2">
        {(["zh", "en"] as const).map((item) => (
          <Button
            key={item}
            type="button"
            variant={language === item ? "default" : "outline"}
            onClick={() => {
              setLanguage(item)
              setConsent(undefined)
            }}
          >
            {item === "zh" ? "中文" : "English"}
          </Button>
        ))}
      </div>
      <Recorder
        label="1. 念出同意句"
        script={sentences[language]}
        maxSeconds={30}
        value={consent}
        onChange={setConsent}
      />
      <Recorder
        label="2. 錄聲音樣本（10 到 60 秒）"
        script={SAMPLE_TEXT[language]}
        maxSeconds={60}
        value={sample}
        onChange={setSample}
      />
    </FormDialog>
  )
}

function Recorder({
  label,
  script,
  maxSeconds,
  value,
  onChange,
}: {
  label: string
  script: string
  maxSeconds: number
  value?: Blob
  onChange: (blob: Blob | undefined) => void
}) {
  const [recorder, setRecorder] = React.useState<MediaRecorder>()
  const [seconds, setSeconds] = React.useState(0)
  const url = React.useMemo(
    () => (value ? URL.createObjectURL(value) : undefined),
    [value]
  )
  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url]
  )

  async function startRecording() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return void toast.error("沒有麥克風權限")
    }
    const media = new MediaRecorder(stream)
    const chunks: Blob[] = []
    const started = Date.now()
    const tick = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000
      setSeconds(elapsed)
      if (elapsed >= maxSeconds) media.stop()
    }, 200)
    media.ondataavailable = (event) => chunks.push(event.data)
    media.onstop = () => {
      clearInterval(tick)
      stream.getTracks().forEach((track) => track.stop())
      onChange(new Blob(chunks, { type: media.mimeType }))
      setRecorder(undefined)
    }
    onChange(undefined)
    setSeconds(0)
    media.start()
    setRecorder(media)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <p className="rounded-control bg-muted p-4">{script}</p>
      <div className="flex items-center gap-4">
        {recorder ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => recorder.stop()}
          >
            停止
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={startRecording}>
            {value ? "重錄" : "錄音"}
          </Button>
        )}
        {recorder && (
          <span className="text-muted-foreground tabular-nums">
            {seconds.toFixed(0)} / {maxSeconds} 秒
          </span>
        )}
        {url && !recorder && (
          <audio src={url} controls className="h-10 min-w-0 flex-1" />
        )}
      </div>
    </div>
  )
}
