import type { Build } from "@/components/app-shell"

// The build running, for the version corner. The commit comes from
// TTS_VERSION (sha-<commit>) at run time, since merging only retags the image
// built on the pull request; the time and the CD run are baked into it.
export function runningBuild(): Build | undefined {
  const sha = process.env.TTS_VERSION?.match(/^sha-([0-9a-f]{7,})$/)?.[1]
  return sha
    ? { sha, time: process.env.BUILD_TIME, url: process.env.BUILD_URL }
    : undefined
}
