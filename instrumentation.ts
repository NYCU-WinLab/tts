import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { OTLPHttpJsonTraceExporter, registerOTel } from "@vercel/otel"

import { emitErrorLog } from "@/lib/otel"

// Traces and error logs go to Sensorium (sensorium.winlab.tw) over OTLP/HTTP
// JSON, only when OTEL_EXPORTER_OTLP_ENDPOINT is set. spanProcessors: []
// stops @vercel/otel from also starting its own protobuf exporter from the
// same env, which would send every span twice.
export async function register() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/+$/, "")
  if (!endpoint) return
  const headers = Object.fromEntries(
    (process.env.OTEL_EXPORTER_OTLP_HEADERS ?? "")
      .split(",")
      .map((pair) => pair.split("=").map((part) => part.trim()))
      .filter(([key, value]) => key && value)
  )

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "tts",
    spanProcessors: [],
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers,
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs`, headers }),
      }),
    ],
  })
}

// Every server error (render, route handler, server action) as a log record.
export async function onRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string }>,
  context: Readonly<{ routeType: string; routePath: string }>
) {
  emitErrorLog(error, {
    "http.route": context.routePath,
    "url.path": request.path,
    "http.request.method": request.method,
    "next.route_type": context.routeType,
  })
}
