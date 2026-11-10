# The GPU worker for tts.winlab.tw. It sits behind NAT on a lab GPU box, so it only calls
# out: it long-polls TTS_URL/api/worker/next for a job, fetches the recordings it needs and
# posts the result to TTS_URL/api/worker/jobs/<id>.
#
# Jobs:
#   speech   IndexTTS-2 speaks params.input in voice params.voiceId, then ffmpeg sets the
#            speed and the format. Posted back as audio bytes.
#   consent  faster-whisper transcribes the consent recording; it passes when the words
#            match params.sentence closely enough.
#   voice    an ECAPA speaker model compares the sample with the consent recording; it
#            passes when they are the same speaker.
#
# IndexTTS-2 stays loaded (about 7.4 GiB); Whisper and ECAPA load on the first check.
import difflib, json, os, re, socket, subprocess, tempfile, time, traceback, urllib.error, urllib.request

URL = os.environ["TTS_URL"].rstrip("/")
TOKEN = os.environ["WORKER_TOKEN"]
MODEL_DIR = os.environ.get("MODEL_DIR", "/models/IndexTTS-2")
# Model downloads (Whisper, ECAPA) only; recordings never touch it.
CACHE = os.environ.get("CACHE_DIR", "/cache")
NAME = os.environ.get("WORKER_NAME", socket.gethostname())
# A reference longer than this only slows IndexTTS down; the start is kept.
REF_MAX_S = float(os.environ.get("REF_MAX_S", "20"))
SAMPLE_MAX_S = 60
CONSENT_MIN_SCORE = float(os.environ.get("CONSENT_MIN_SCORE", "0.85"))
SAME_SPEAKER_MIN = float(os.environ.get("SAME_SPEAKER_MIN", "0.5"))

ENCODE = {
    "mp3": (["-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3"], "audio/mpeg"),
    "opus": (["-c:a", "libopus", "-b:a", "64k", "-f", "ogg"], "audio/ogg"),
    "aac": (["-c:a", "aac", "-b:a", "128k", "-f", "adts"], "audio/aac"),
    "flac": (["-c:a", "flac", "-f", "flac"], "audio/flac"),
    "wav": (["-c:a", "pcm_s16le", "-f", "wav"], "audio/wav"),
    "pcm": (["-c:a", "pcm_s16le", "-ar", "24000", "-ac", "1", "-f", "s16le"], "audio/pcm"),
}


def log(*args):
    print(time.strftime("%Y-%m-%dT%H:%M:%S"), *args, flush=True)


def request(method, path, body=None, headers=None, timeout=60):
    req = urllib.request.Request(URL + path, data=body, method=method, headers={
        "authorization": "Bearer " + TOKEN, "x-worker": NAME, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.headers.get("content-type", ""), r.read()


def report(job_id, body, content_type="application/json", headers=None):
    if content_type == "application/json":
        body = json.dumps(body).encode()
    request("POST", f"/api/worker/jobs/{job_id}", body, {"content-type": content_type, **(headers or {})})


def ffmpeg(args, data=None):
    p = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *args], input=data,
                       capture_output=True)
    if p.returncode:
        raise RuntimeError("ffmpeg: " + p.stderr.decode(errors="replace")[-300:])
    return p.stdout


def duration(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                        "default=nw=1:nk=1", path], capture_output=True, text=True)
    return float(p.stdout.strip() or 0)


def fetch_wav(kind, ident, rate, tmp, max_s=None):
    """A recording from the web app as mono WAV at rate, in the job's temp folder tmp.
    Nothing is kept after the job: a deleted voice leaves no copy on this box."""
    _, _, data = request("GET", f"/api/worker/audio/{kind}/{ident}")
    src = os.path.join(tmp, f"{kind}.src")
    path = os.path.join(tmp, f"{kind}.{rate}.wav")
    with open(src, "wb") as f:
        f.write(data)
    ffmpeg(["-i", src, *(["-t", str(max_s)] if max_s else []), "-ac", "1",
            "-ar", str(rate), "-c:a", "pcm_s16le", path])
    os.remove(src)
    return path


tts = whisper = ecapa = None


def load_tts():
    global tts
    if tts is None:
        t = time.time()
        os.chdir("/opt/index-tts")
        from indextts.infer_v2 import IndexTTS2
        tts = IndexTTS2(cfg_path=f"{MODEL_DIR}/config.yaml", model_dir=MODEL_DIR, use_fp16=True,
                        use_cuda_kernel=False, use_deepspeed=False)
        log("IndexTTS-2 loaded in %.0fs" % (time.time() - t))
    return tts


def speech(job):
    p = job["params"]
    with tempfile.TemporaryDirectory() as tmp:
        ref = fetch_wav("voice", p["voiceId"], 24000, tmp, REF_MAX_S)
        raw = os.path.join(tmp, "raw.wav")
        t = time.time()
        load_tts().infer(spk_audio_prompt=ref, text=p["input"], output_path=raw, verbose=False)
        made = time.time() - t
        speed = float(p.get("speed") or 1)
        filters = []
        while speed > 2:  # atempo takes 0.5 to 2 per stage
            filters.append("atempo=2"); speed /= 2
        while speed < 0.5:
            filters.append("atempo=0.5"); speed /= 0.5
        if abs(speed - 1) > 1e-3:
            filters.append(f"atempo={speed:.4f}")
        args, mime = ENCODE[p.get("format", "mp3")]
        out = os.path.join(tmp, "out")
        ffmpeg(["-i", raw, *(["-af", ",".join(filters)] if filters else []), *args, out])
        seconds = duration(raw) / float(p.get("speed") or 1)
        report(job["id"], open(out, "rb").read(), mime, {"x-audio-seconds": f"{seconds:.2f}"})
        log(f"speech {job['id']} {len(p['input'])} chars -> {seconds:.1f}s audio in {made:.1f}s")


def normalize(text, language):
    if language == "zh":
        from pypinyin import lazy_pinyin
        # Pinyin forgives simplified and traditional forms and homophones Whisper picks.
        text = "".join(ch for ch in text if "一" <= ch <= "鿿" or ch.isalnum())
        return " ".join(lazy_pinyin(text)).lower().replace("winlab", "win lab")
    return re.sub(r"[^a-z ]", "", text.lower()).split()


# Words that turn the sentence around ("I do not consent"); one heard but not in the
# sentence rejects the recording however close the rest is.
NEGATIONS = {"zh": set("不沒没未別别拒否反"),
             "en": {"not", "no", "never", "dont", "doesnt", "didnt", "wont", "cannot",
                    "cant", "refuse", "withdraw", "nor"}}


def negated(sentence, heard, language):
    if language == "zh":
        return any(ch in heard and ch not in sentence for ch in NEGATIONS["zh"])
    said = set(re.sub(r"[^a-z ]", "", heard.lower().replace("'", "").replace("’", "")).split())
    want = set(re.sub(r"[^a-z ]", "", sentence.lower()).split())
    return bool((said - want) & NEGATIONS["en"])


def consent(job):
    with tempfile.TemporaryDirectory() as tmp:
        check_consent(job, tmp)


def check_consent(job, tmp):
    global whisper
    p = job["params"]
    path = fetch_wav("consent", p["consentId"], 16000, tmp)
    if duration(path) > 30:
        return report(job["id"], {"kind": "consent", "ok": False, "transcript": "", "score": 0,
                                  "reason": "同意錄音超過 30 秒"})
    if whisper is None:
        from faster_whisper import WhisperModel
        whisper = WhisperModel("large-v3", device="cuda", compute_type="int8_float16",
                               download_root=os.path.join(CACHE, "whisper"))
    segments, _ = whisper.transcribe(path, language=p["language"], beam_size=5,
                                     initial_prompt="以下是繁體中文。" if p["language"] == "zh" else None)
    heard = "".join(s.text for s in segments).strip()
    want, got = normalize(p["sentence"], p["language"]), normalize(heard, p["language"])
    score = difflib.SequenceMatcher(None, want, got).ratio() if want else 0
    refused = negated(p["sentence"], heard, p["language"])
    ok = score >= CONSENT_MIN_SCORE and not refused
    reason = "錄音裡有否定的話" if refused else "沒有完整念出同意句子"
    report(job["id"], {"kind": "consent", "ok": ok, "transcript": heard, "score": round(score, 3),
                       **({} if ok else {"reason": reason})})
    log(f"consent {p['consentId']} score {score:.2f} ok={ok}")


def embedding(path):
    global ecapa
    import torch, torchaudio
    if ecapa is None:
        from speechbrain.inference.speaker import EncoderClassifier
        ecapa = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb",
                                               savedir=os.path.join(CACHE, "ecapa"),
                                               run_opts={"device": "cuda"})
    wav, _ = torchaudio.load(path)
    with torch.no_grad():
        return ecapa.encode_batch(wav.to("cuda")).squeeze()


def voice(job):
    with tempfile.TemporaryDirectory() as tmp:
        check_voice(job, tmp)


def check_voice(job, tmp):
    import torch
    p = job["params"]
    sample = fetch_wav("voice", p["voiceId"], 16000, tmp)
    seconds = duration(sample)
    reason = ("聲音樣本超過 60 秒" if seconds > SAMPLE_MAX_S else
              "聲音樣本短於 3 秒" if seconds < 3 else None)
    if reason:
        return report(job["id"], {"kind": "voice", "ok": False, "similarity": 0, "reason": reason})
    mine = embedding(sample)
    # A built-in voice has no consent recording: only its embedding is kept.
    same = 1.0 if not p.get("consentId") else float(torch.nn.functional.cosine_similarity(
        mine, embedding(fetch_wav("consent", p["consentId"], 16000, tmp)), dim=0))
    ok = same >= SAME_SPEAKER_MIN
    report(job["id"], {"kind": "voice", "ok": ok, "similarity": round(same, 3),
                       "embedding": [round(float(x), 5) for x in mine.cpu()],
                       **({} if ok else {"reason": "和同意錄音不是同一人"})})
    log(f"voice {p['voiceId']} similarity {same:.2f} ok={ok}")


HANDLERS = {"speech": speech, "consent": consent, "voice": voice}


def main():
    load_tts()
    log("polling", URL, "as", NAME)
    while True:
        try:
            status, _, body = request("GET", "/api/worker/next", timeout=40)
        except Exception as e:  # noqa: BLE001  the web app restarting or the network
            log("poll:", e)
            time.sleep(5)
            continue
        if status == 204:
            continue
        job = json.loads(body)
        try:
            HANDLERS[job["kind"]](job)
        except Exception as e:  # noqa: BLE001  report it, keep serving
            traceback.print_exc()
            try:
                report(job["id"], {"kind": "error", "error": str(e)[:300]})
            except Exception as e2:  # noqa: BLE001
                log("report:", e2)


if __name__ == "__main__":
    main()
