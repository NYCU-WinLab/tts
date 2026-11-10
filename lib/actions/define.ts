import { z } from "zod"

import { announceChange } from "@/lib/actions/changes"
import { traced } from "@/lib/otel"

/**
 * Who is acting: the signed-in member, and whether through a page or an
 * MCP client (recorded on the action's span).
 */
export type Actor = {
  userId: string
  /** api: an API key on the OpenAI-style /v1 endpoints. */
  via: "web" | "mcp" | "api" | "service"
  /** Set when a trusted service (portal) calls /api/actions with its key;
   * userId is then empty and the action names the member itself. */
  service?: string
}

/**
 * Every read and write tts does is one of these, defined once. Pages
 * call it through runAction, and lib/mcp/server.ts turns each one into a
 * tool, so what a member can do on a page an agent can do through MCP. An
 * action that must stay off MCP says why in mcpExcludedBecause;
 * scripts/check-actions.ts fails CI on an action missing from the registry.
 */
export type Action<
  Input extends z.ZodObject = z.ZodObject,
  Output = unknown,
> = {
  /** snake_case; also the MCP tool name. */
  name: string
  /** What a member calls it, in Chinese: the MCP tool title. */
  title: string
  /** For agents, in English: when to use it and what it returns. */
  description: string
  /** query reads, mutation writes; MCP marks queries read-only. */
  kind: "query" | "mutation"
  input: Input
  run: (actor: Actor, input: z.infer<Input>) => Promise<Output>
  /** Set only to keep it off MCP, with the reason. */
  mcpExcludedBecause?: string
  /** A frequent write no page needs at once (usage logs): it does not make
   * every open page refresh. */
  quiet?: boolean
}

/** Names of every action created, for the registry check. */
export const defined = new Set<string>()

export function defineAction<Input extends z.ZodObject, Output>(
  action: Action<Input, Output>
): Action<Input, Output> {
  defined.add(action.name)
  return action
}

/** Parses the input the same way for pages and MCP, then runs it. */
export async function runAction<Input extends z.ZodObject, Output>(
  action: Action<Input, Output>,
  actor: Actor,
  /** Untrusted input from a page or an MCP client; parsed here either way. */
  input: unknown
): Promise<Output> {
  return traced(
    `action ${action.name}`,
    { "action.name": action.name, "action.kind": action.kind, via: actor.via },
    async () => {
      const result = await action.run(actor, action.input.parse(input))
      // Open pages refresh on this; a failed announcement never fails the
      // change itself.
      if (action.kind === "mutation" && !action.quiet)
        await announceChange(action.name).catch(() => {})
      return result
    }
  )
}

/** What to tell a member when an action fails: the first input problem, or
 * the action's own message. */
export function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "輸入有誤"
  if (error instanceof Error) return error.message
  return "失敗了"
}
