# The GPU worker: IndexTTS-2 for speech, faster-whisper and an ECAPA speaker model for the
# consent check. It only makes outbound connections to the web app (see worker.py).
FROM python:3.11-slim-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends git git-lfs ffmpeg ca-certificates build-essential \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH PYTHONUNBUFFERED=1 HF_HOME=/models/hf

# IndexTTS-2 is not on PyPI; pin the commit that furnace runs.
ARG INDEXTTS_REV=d9e41aac89fd00b3d71497fddb287b7f24613712
WORKDIR /opt/index-tts
RUN git clone --filter=blob:none https://github.com/index-tts/index-tts . \
 && git checkout "$INDEXTTS_REV" \
 && uv sync --frozen --no-dev --python /usr/local/bin/python3.11 \
 && uv pip install --python /opt/venv/bin/python faster-whisper==1.2.1 speechbrain==1.0.3 pypinyin \
 && rm -rf /root/.cache

ENV PYTHONPATH=/opt/index-tts
WORKDIR /app
COPY *.py /app/
CMD ["python", "/app/worker.py"]
