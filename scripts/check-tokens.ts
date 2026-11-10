// Everything visual must come from the base tokens. This rejects the ways
// around them: sizes outside text-title / text-body, radii outside the
// concentric scale, arbitrary values, Tailwind palette colors, color
// literals, inline styles and raw font-size. Page code (outside
// components/) also may not draw layer-2 surfaces; see DESIGN.md.
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const roots = ["app", "components", "lib"]
const palette =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white"
const colorUtilities =
  "bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow"

const patterns = [
  {
    name: "size outside the scale",
    regex: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g,
  },
  // Arbitrary values such as rounded-[10px]; arbitrary variants such as
  // data-[state=open]: end in ":" or "/" and stay allowed.
  {
    name: "arbitrary value",
    regex: /\b[a-z][\w-]*-\[[^\]\s]+\](?![:/\]])/g,
  },
  // rounded-control / -menu / -surface / -full only.
  {
    name: "radius outside the scale",
    regex:
      /\brounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?(?:-(?:none|xs|sm|md|lg|xl|[2-4]xl))?\b(?!-)/g,
  },
  // Motion comes from duration-state / duration-overlay only.
  {
    name: "duration or easing outside the tokens",
    regex:
      /\b(?:duration-(?:\d+|\()|ease-(?:linear|in|out|in-out)\b|delay-\d+)/g,
  },
  {
    name: "palette color",
    regex: new RegExp(`\\b(?:${colorUtilities})-(?:${palette})\\b`, "g"),
  },
  // secondary, accent and card duplicated other colors, overlays are
  // frosted glass instead of popover, charts use the existing colors, and
  // there is no sidebar in the two-layer model.
  {
    name: "removed color token",
    regex:
      /\b[a-z]+-(?:secondary|accent|card|popover|sidebar|chart)(?![\w])(?:-[\w-]+)?/g,
  },
  {
    name: "color literal",
    regex: /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/g,
  },
  { name: "inline style", regex: /\bstyle=\{/g },
  { name: "CSS font-size", regex: /\bfont-size\s*:/g },
  // Copy separates with ，、。 or a line break, never a middle dot or a dash.
  { name: "middle dot or dash in copy (use ，、。)", regex: /[·•—–]/g },
]

// Layer 1 (the page) groups by spacing and dividers only.
const pagePatterns = [
  { name: "shadow on a page", regex: /\bshadow(?:-[\w/]+)?/g },
  {
    name: "frame on a page (use spacing or border-t / border-b)",
    regex: /(?<![-\w])border(?:-[xy])?(?![-\w])/g,
  },
]
// Pages under app/ may not draw layer 2; components and the libraries
// installed from ui.winlab.tw (lib/field.ts) may.
const pageRoot = "app"

async function* files(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (/\.(tsx?|css)$/.test(entry.name)) yield path
  }
}

let failed = false
for (const root of roots) {
  for await (const path of files(root)) {
    // globals.css defines the tokens themselves.
    if (path === join("app", "globals.css")) continue
    const lines = (await readFile(path, "utf8")).split("\n")
    const isComponent = !path.startsWith(pageRoot)
    const rules = isComponent ? patterns : [...patterns, ...pagePatterns]
    lines.forEach((line, index) => {
      for (const { name, regex } of rules) {
        for (const match of line.matchAll(regex)) {
          console.error(`${path}:${index + 1}: ${name}: ${match[0]}`)
          failed = true
        }
      }
    })
  }
}

if (failed) process.exit(1)
console.log("everything uses the tokens")
