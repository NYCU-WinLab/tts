import { SpanStatusCode, trace } from "@opentelemetry/api"
import { logs, SeverityNumber } from "@opentelemetry/api-logs"

const tracer = trace.getTracer("tts")
const logger = logs.getLogger("tts")

/** An error as a log record; a no-op until instrumentation registers. */
export function emitErrorLog(
  error: unknown,
  attributes: Record<string, string | number | boolean | undefined>
) {
  logger.emit({
    severityNumber: SeverityNumber.ERROR,
    severityText: "ERROR",
    body: error instanceof Error ? error.message : String(error),
    attributes: {
      ...attributes,
      "exception.type": error instanceof Error ? error.name : typeof error,
    },
  })
}

/**
 * Runs fn in a span: name, outcome and duration, plus the attributes given
 * (ids and counts only, never member content or secrets).
 */
export async function traced<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn()
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    } finally {
      span.end()
    }
  })
}
