```
████████╗████████╗███████╗
╚══██╔══╝╚══██╔══╝██╔════╝
   ██║      ██║   ███████╗
   ██║      ██║   ╚════██║
   ██║      ██║   ███████║
   ╚═╝      ╚═╝   ╚══════╝
```

# WinLab TTS

> Text to speech in cloned voices for lab members, with the OpenAI API: change the base URL and the OpenAI SDK speaks in your own voice.

`nextjs` `indextts` `openai-api` `postgres` `docker` `mcp`

[![CI](https://github.com/NYCU-WinLab/tts/actions/workflows/ci.yml/badge.svg)](https://github.com/NYCU-WinLab/tts/actions) &nbsp;[![Image](https://img.shields.io/badge/image-ghcr.io%2Fnycu--winlab%2Ftts-111111)](https://github.com/NYCU-WinLab/tts/pkgs/container/tts) &nbsp;[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

Members sign in with their lab account. Speech runs on a lab GPU with IndexTTS-2, so no text or voice leaves the lab.

```
> "Say 'the meeting moves to 2 pm' in CC's voice"
  ⚡ speak { "input": "會議改到下午兩點", "voice": "cctseng" }
✓ { "url": "https://tts.winlab.tw/a/…/….mp3", "seconds": 2.1 }
```

## What it does

- **Speaks text** in a voice through `POST /v1/audio/speech`, the page, or MCP.
- **Transcribes a recording** through `POST /v1/audio/transcriptions`, and with the text it should say, scores the reading and lists the characters read differently.
- **Clones a member's own voice** from a consent recording and a sample of up to 60 seconds, recorded in the browser or sent to `/v1/audio/voice_consents` and `/v1/audio/voices`. Each member has one voice, named after their lab account; recording again replaces it.
- **Checks consent**: Whisper must hear the fixed consent sentence, and a speaker model must find the sample and the consent recording to be the same person.
- **Keeps a voice private** until its owner shares it with every member; the owner can delete it, and its recordings go with it.
- **Lets an admin add a member's voice** with a note of how the speaker agreed, such as Prof. Tseng's (`cctseng`), owned by that member.

## Use

Make a key at https://tts.winlab.tw/keys, then:

```bash
curl https://tts.winlab.tw/v1/audio/speech \
  -H "Authorization: Bearer $TTS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "indextts-2", "input": "大家好", "voice": "cctseng"}' \
  -o speech.mp3
```

```python
from openai import OpenAI

client = OpenAI(base_url="https://tts.winlab.tw/v1", api_key=TTS_API_KEY)
client.audio.speech.create(model="indextts-2", voice="cctseng", input="大家好").write_to_file("speech.mp3")
```

- `voice`: the owner's lab account name (`cctseng`), a voice id (`voice_…`), or `{"id": "voice_…"}`.
- `response_format`: `mp3` (default), `opus`, `aac`, `flac`, `wav` or `pcm` (24 kHz, 16-bit mono).
- `speed`: 0.25 to 4.
- `model` is accepted and ignored: there is one model.
- `input`: up to 1,000 characters. A sentence takes a few seconds.

Your own voice, as OpenAI's custom voices:

```bash
# 1. Read the sentence for your language (GET /v1/audio/voice_consents lists them).
curl https://tts.winlab.tw/v1/audio/voice_consents -H "Authorization: Bearer $TTS_API_KEY" \
  -F language=zh -F recording=@consent.wav
# 2. A sample of the same speaker, 60 seconds or less.
curl https://tts.winlab.tw/v1/audio/voices -H "Authorization: Bearer $TTS_API_KEY" \
  -F audio_sample=@sample.wav -F consent=cons_… -F shared=true
```

Check generated speech with Whisper. `expected` is a WinLab extension: the text the recording should say.

```bash
curl https://tts.winlab.tw/v1/audio/transcriptions -H "Authorization: Bearer $TTS_API_KEY" \
  -F file=@speech.mp3 -F language=zh -F expected="著急的時候，差一點就忘了。"
# {"text":"這急的時候，差一點就忘了。","expected_score":0.909,
#  "differences":[{"expected":"著","heard":"這","reading":"zhao -> zhe"}]}
```

- `response_format`: `json` (default), `text` or `verbose_json` (adds `language`, `duration` and `segments` with start and end seconds; send `timestamp_granularities[]=word` for `words` as well).
- `expected_score` compares pinyin without tones for Chinese, so a homophone Whisper writes differently still matches; `reading` shows the readings compared. A misread that only changes the tone is not caught.
- A recording up to 10 MB and 10 minutes. `model` is accepted and ignored: it is Whisper large-v3.

A `name` is ignored: the voice takes your name. `shared=true` lets every member speak in it. `GET /v1/audio/voices` lists the voices you can use; `DELETE /v1/audio/voices/<id>` deletes yours.

## MCP

`https://tts.winlab.tw/mcp`. Sign in through the lab Keycloak with the public client `tts-mcp`; Keycloak's registration is closed, so the client id has to be given. Sign in on the website once first, so your account exists here.

```sh
claude mcp add --transport http tts https://tts.winlab.tw/mcp --client-id tts-mcp --callback-port 3118
```

Tools: `whoami`, `list_voices`, `speak` (returns a link that works for 24 hours), `list_speeches`, `delete_speech`, `share_voice`, `delete_voice`, `list_voice_consents`, `my_usage`, `list_api_keys`, `revoke_api_key`.

## How it works

```
browser / SDK / MCP ──▶ web (Carrel, tts.winlab.tw) ──▶ Postgres: keys, voices, jobs
                                     ▲
                                     │ long-poll /api/worker/next, post results
                                     │
                         worker (GPU box behind NAT): IndexTTS-2, Whisper, ECAPA
```

The worker only makes outbound HTTPS calls, so the GPU box needs no open port. A request waits on its job row until the worker posts the audio.

## Deploy

The web app is one image with Postgres beside it:

```bash
cp .env.example .env   # fill it in
docker compose up -d
```

The worker runs on any machine with an NVIDIA GPU (16 GB is plenty; IndexTTS-2 peaks at 7.4 GiB):

```bash
cd worker
hf download IndexTeam/IndexTTS-2 --local-dir models/IndexTTS-2
printf 'TTS_URL=https://tts.example.com\nWORKER_TOKEN=…\n' > .env
docker compose up -d --build
```

### Configuration

See `.env.example`. `WORKER_TOKEN` must match on both sides. `TTS_ADMINS` lists who may add a member's voice from a consent note.

## Limitations

- One worker serves one job at a time; a busy queue answers `429` past 3 waiting requests per member.
- No streaming: the audio comes back whole.
- Audio links and results are kept for 24 hours.
- A recording sent for transcription is deleted once heard, and its transcript once the answer is sent; neither stays more than 10 minutes.

## Develop

```bash
bun install
bun run typecheck && bun run lint && bun run actions:check && bun run build
```

## License

MIT
