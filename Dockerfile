# syntax=docker/dockerfile:1
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build \
 && bun build scripts/migrate.ts --target node --external pg-native --outfile migrate.mjs

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# The lab is in Taipei.
ENV TZ=Asia/Taipei
# The build corner tips the time and links the run. Last, so a new run
# reuses every layer above; the commit comes from TTS_VERSION at run time.
ARG BUILD_TIME BUILD_URL
ENV BUILD_TIME=$BUILD_TIME BUILD_URL=$BUILD_URL
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/migrate.mjs ./migrate.mjs
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
# web by default; compose's migrate service runs `node migrate.mjs`.
CMD ["node", "server.js"]
