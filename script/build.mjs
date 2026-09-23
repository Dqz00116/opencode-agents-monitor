#!/usr/bin/env bun
// Compiles src/index.tsx -> dist/index.js for the opencode TUI plugin loader.
// Runtime module ids are baked in at build time using the host's scheme
// (`opentui:runtime-module:${encodeURIComponent(spec)}`) — the same ids the
// host itself produces when it transforms a file plugin at load. This is
// deliberate: the host's load-time import-rewriting regex requires whitespace
// after `from`/`import` (`/(from\s+["'])/` in @opentui/core runtime-plugin.js),
// so minified `from"solid-js"` imports would be invisible to it and would
// resolve to the SSR build (solid-js/dist/server.js), crashing slot rendering.
// The baked ids must also be listed as `external` so the bundler doesn't try
// to resolve them.
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const runtimeId = (spec) => `opentui:runtime-module:${encodeURIComponent(spec)}`

const RUNTIME_SPECIFIERS = new Set([
  "@opentui/solid",
  "@opentui/solid/components",
  "@opentui/solid/jsx-runtime",
  "@opentui/solid/jsx-dev-runtime",
  "@opentui/core",
  "@opentui/core/testing",
  "solid-js",
  "solid-js/store",
  // The v2 TUI plugin API must be the host's instance (its Solid context object
  // is module-level), so it is provided as a runtime module like solid-js.
  "@opencode/plugin/tui",
])

const result = await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  format: "esm",
  target: "bun",
  minify: true,
  plugins: [
    createSolidTransformPlugin({
      moduleName: runtimeId("@opentui/solid"),
      resolvePath(spec) {
        return RUNTIME_SPECIFIERS.has(spec) ? runtimeId(spec) : null
      },
    }),
  ],
  external: [...RUNTIME_SPECIFIERS, ...[...RUNTIME_SPECIFIERS].map(runtimeId)],
})

if (!result.success) {
  console.error(result.logs)
  process.exit(1)
}
console.log("built:", result.outputs.map((o) => o.path))
