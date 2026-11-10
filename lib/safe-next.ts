/**
 * A path on this site to return to after sign-in; anything else is "/".
 * Browsers read "/\x" and "/<tab>/x" as another host, so backslashes and
 * control characters are refused along with "//".
 */
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/"
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return "/"
  return next
}
