// Keeps pages and MCP in step. Every action in lib/actions must be in the
// registry (MCP builds its tools from it), each must be well-formed, and
// only lib/actions, lib/auth and lib/db may touch the database, so nothing
// reaches it around an action.
import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import ts from "typescript"

import { defined } from "@/lib/actions/define"
import { actions } from "@/lib/actions/registry"

const problems: string[] = []
const root = process.cwd()
const sourceFile = /\.[cm]?[jt]sx?$/

async function* sources(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      // .well-known holds routes; every other dot folder is tooling.
      if (entry.name !== ".well-known") continue
    }
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* sources(path)
    else if (sourceFile.test(entry.name) && !entry.name.endsWith(".d.ts"))
      yield relative(root, path)
  }
}

// Load every action module, subfolders too, so defineAction records its name.
for await (const path of sources("lib/actions")) {
  if (/\.test\.[jt]sx?$/.test(path)) continue
  if (path === "lib/actions/define.ts" || path === "lib/actions/registry.ts")
    continue
  await import(resolve(root, path))
}

const registered = new Set(actions.map((action) => action.name))
for (const name of defined) {
  if (!registered.has(name))
    problems.push(`${name}: not in lib/actions/registry.ts`)
}
if (registered.size !== actions.length) problems.push("duplicate action names")

for (const action of actions) {
  if (!/^[a-z][a-z0-9_]*$/.test(action.name))
    problems.push(`${action.name}: name must be snake_case`)
  if (!/\p{Script=Han}/u.test(action.title))
    problems.push(`${action.name}: title must be Chinese, as members call it`)
  if (action.description.length < 40)
    problems.push(`${action.name}: description too short for an agent`)
  if (
    action.mcpExcludedBecause !== undefined &&
    !action.mcpExcludedBecause.trim()
  )
    problems.push(`${action.name}: mcpExcludedBecause needs a reason`)
}

// Who may import what. The database is lib/db; the Better Auth instance
// (lib/auth/index.ts) also reaches it, through auth.api and
// auth.$context.adapter, so only the routes that mount it may hold it.
const inside = (path: string, dirs: string[]) =>
  dirs.some((dir) => path === dir || path.startsWith(`${dir}/`))
const owners = ["lib/actions", "lib/auth", "lib/db"]
const authMounts = ["app/api/auth", "app/.well-known", "app/mcp", "app/sign-in"]
// The checkers load action modules by computed path on purpose.
const skipped = ["scripts/check-actions.ts", "scripts/check-tokens.ts"]

const config = ts.parseJsonConfigFileContent(
  ts.readConfigFile("tsconfig.json", ts.sys.readFile).config,
  ts.sys,
  root
)
const host = ts.createCompilerHost(config.options)
const target = (specifier: string, from: string) => {
  const resolved = ts.resolveModuleName(
    specifier,
    resolve(root, from),
    config.options,
    host
  ).resolvedModule
  return resolved ? relative(root, resolved.resolvedFileName) : undefined
}

// Every way a file can name another module: import and export ... from,
// import x = require(), import(), require(), import type.
function specifiers(file: ts.SourceFile) {
  const found: { text?: string; node: ts.Node }[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      found.push({
        text: (node.moduleSpecifier as ts.StringLiteral).text,
        node,
      })
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const expression = node.moduleReference.expression
      found.push({
        text: ts.isStringLiteralLike(expression) ? expression.text : undefined,
        node,
      })
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const [argument] = node.arguments
      found.push({
        text:
          argument && ts.isStringLiteralLike(argument)
            ? argument.text
            : undefined,
        node,
      })
    } else if (ts.isImportTypeNode(node)) {
      const literal = ts.isLiteralTypeNode(node.argument)
        ? node.argument.literal
        : undefined
      found.push({
        text: literal && ts.isStringLiteral(literal) ? literal.text : undefined,
        node,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

function contextReads(file: ts.SourceFile) {
  const found: ts.Node[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isPropertyAccessExpression(node) && node.name.text === "$context") ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteralLike(node.argumentExpression) &&
        node.argumentExpression.text === "$context")
    )
      found.push(node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

for await (const path of sources(".")) {
  if (inside(path, owners) || skipped.includes(path)) continue
  const file = ts.createSourceFile(
    path,
    await readFile(path, "utf8"),
    ts.ScriptTarget.Latest,
    true
  )
  const at = (node: ts.Node) =>
    `${path}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
  for (const { text, node } of specifiers(file)) {
    if (text === undefined) {
      problems.push(`${at(node)}: import with a computed path`)
      continue
    }
    const to = target(text, path)
    if (to && inside(to, ["lib/db"]))
      problems.push(`${at(node)}: reads the database outside lib/actions`)
    else if (
      to === "lib/auth/index.ts" &&
      !inside(path, authMounts) &&
      !inside(path, owners)
    )
      problems.push(
        `${at(node)}: the auth instance is only for the routes that mount it; use lib/auth/session or an action`
      )
  }
  for (const node of contextReads(file))
    problems.push(`${at(node)}: auth.$context reaches the database`)
}

if (problems.length) {
  for (const problem of problems) console.error(problem)
  process.exit(1)
}
console.log(`${actions.length} actions, all on MCP or excused`)
