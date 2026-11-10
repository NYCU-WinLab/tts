#!/usr/bin/env bash
# The image as deployed: compose up with Postgres, migrations, then probe
# sign-in, the /v1 API, the worker endpoints, OAuth discovery and MCP.
# ci runs it with the image loaded as ghcr.io/nycu-winlab/tts:ci.
set -euo pipefail
trap 'docker compose logs' EXIT

cat > .env <<ENV
TTS_VERSION=ci
TTS_PORT=3000
POSTGRES_PASSWORD=ci-$(openssl rand -hex 8)
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
KEYCLOAK_ISSUER=https://auth.winlab.tw/realms/winlab
KEYCLOAK_CLIENT_ID=ci
KEYCLOAK_CLIENT_SECRET=ci
WORKER_TOKEN=ci-worker
ENV
docker compose up -d --wait web

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
docker compose logs migrate | grep -q "migrations applied"
test "$(code localhost:3000/sign-in)" = 303
test "$(code localhost:3000/)" = 307
test "$(code -X POST localhost:3000/v1/audio/speech -d '{}')" = 401
curl -s -X POST localhost:3000/v1/audio/speech -H 'authorization: Bearer sk-tts-nope' -d '{}' | grep -q '"code":"invalid_api_key"'
test "$(code localhost:3000/api/worker/next)" = 401
test "$(code localhost:3000/api/worker/next -H 'authorization: Bearer ci-worker' --max-time 30)" = 204
test "$(code localhost:3000/a/00000000-0000-0000-0000-000000000000/x.mp3)" = 404
curl -sf localhost:3000/.well-known/oauth-protected-resource/mcp | grep -q '"resource":"http://localhost:3000/mcp"'
test "$(code -X POST localhost:3000/mcp -H 'content-type: application/json' -d '{}')" = 401
echo "smoke passed"
