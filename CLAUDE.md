@AGENTS.md

# WinLab TTS

Text to speech with cloned voices at tts.winlab.tw: a Next.js app with its own Postgres (sign-in, API keys, voices, the job queue) on Carrel, and a GPU worker running IndexTTS-2 on a lab GPU box that only calls out to it. Built on the same skeleton as NYCU-WinLab/meet, gallery and portal; keep them alike.

## Rules

- **Every read and write is an action** in `lib/actions/<area>.ts`, made with `defineAction` and listed in `lib/actions/registry.ts`. Pages call `runAction(action, actor, input)`, `/v1` routes call the same actions as the API key's member, and `lib/mcp/server.ts` builds the MCP tools from the registry. Never write a separate MCP tool or a page-only query.
- **Only `lib/actions`, `lib/auth` and `lib/db` import `@/lib/db`.** `bun run actions:check` fails otherwise, and when an action is missing from the registry.
- **An action stays off MCP only with a reason** in `mcpExcludedBecause`, e.g. `create_api_key`, which mints a credential.
- **Action fields**: `name` snake_case (the tool name), `title` in Chinese (what members call it), `description` in English for agents, `kind` query or mutation.
- **Permissions live in the action's `run`**, checked against `actor.userId`; a page, an API key and an MCP call get the same answer.
- **The /v1 API follows OpenAI** (`/v1/audio/speech`, `/v1/audio/voice_consents`, `/v1/audio/voices`): same paths, fields and error shape, so OpenAI SDKs work with `base_url` changed. Extensions (built-in voices, `GET` lists) add fields; they never rename OpenAI's.
- **The worker only calls out.** It sits behind NAT, long-polls `/api/worker/next` with `WORKER_TOKEN`, fetches recordings from `/api/worker/audio/...` and posts results to `/api/worker/jobs/<id>`. The queue is the `jobs` table (`lib/actions/jobs.ts`); callers wait on the row.
- **Consent before cloning.** A member's voice needs a verified consent recording (the fixed sentence in `CONSENT_SENTENCES`, checked by Whisper) and a sample of the same speaker (checked by ECAPA). Built-in voices need an admin (`TTS_ADMINS`) and a consent note saying how the speaker agreed.
- **Schema**: edit `lib/db/*.ts`, run `bun run db:generate`, commit the SQL in `drizzle/`. Tables are snake_case plurals; the Better Auth tables keep its model names as export keys.
- **Members only.** Every page calls `requireActor`. The open routes are sign-in, `/v1` (API key), `/api/worker` (worker token), `/mcp` (OAuth) and `/a/<job>/<secret>.<ext>`, the 24-hour audio link `speak` returns.
- **Observability**: actions run in a span (`action <name>`, with `via` web, api or mcp); send ids and counts, never the text or the audio.

## Verify

`bun run typecheck && bun run lint && bun run format:check && bun run tokens:check && bun run actions:check && bun run build`, on the sandbox, not the MacBook. Then on https://tts.winlab.tw: make a key on /keys, `curl /v1/audio/speech` with voice `cc` and play the file; record a voice on /voices and speak in it.
