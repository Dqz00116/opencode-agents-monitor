# AGENTS.md

OpenCode TUI plugin that renders an Agents sidebar. The entire plugin is one TypeScript/TSX file (`src/index.tsx`) using Solid.js with the `@opentui/solid` renderer. This repo has **no tests, no lint, no CI, and no tsconfig** — do not invent those workflows.

## Commands

- Install dependencies: `bun install` (bun is the package manager; no lockfile is committed, versions float within `^` ranges).
- Build the published entry: `bun install` then `bun run build` (writes `dist/index.js` via `script/build.mjs` — the Solid JSX transform from `@opentui/solid/bun-plugin`, runtime specifiers kept external). There are no tests, no lint, no typecheck script; `bun x tsc --noEmit` won't work without a tsconfig. Verification is manual (below).
- Regenerate logo assets after touching them: `node script/logo.mjs` (writes `assets/logo-dark.svg`, `assets/logo-light.svg`).

## Manual verification (the only test path)

1. Add `"plugin": ["./<absolute-path>/src/index.tsx"]` to `tui.json` — global `~/.config/opencode/tui.json` or project `.opencode/tui.json` — then restart OpenCode (requires opencode >= 1.18.0, per `engines` in package.json). (For the npm install path: `opencode plugin opencode-agents-monitor -f` and a restart.)
2. Open a session and press `ctrl+x` then `b` to show the sidebar; check the Agents widget renders and updates.

## Architecture notes

- Entrypoint is `package.json` `exports["./tui"]` → `src/index.tsx`, which exports the default plugin (id `agents-sidebar`, registers into the `sidebar_content` slot with `order: 150`).
- Widget state lives in a `createTracker()` created via `createRoot` *outside* the slot component tree (`src/index.tsx`) so slot re-renders don't reset it. Preserve this structure.
- Data flow: `session.created/updated/deleted` events plus one `session.list()`; live status from `api.state.session.status`; lazy `session.messages` hydration for pre-TUI agents.

## Gotchas

- Keep the `/** @jsxImportSource @opentui/solid */` pragma at line 1 — the JSX transform depends on it.
- Plugin id `agents-sidebar` intentionally differs from the npm package name `opencode-agents-monitor`; do not rename the id.
- Code uses ES2023 `Array.prototype.findLast` and bare `catch {}` (deliberate API-error swallowing). Keep a modern runtime; don't "clean up" the empty catches.
- `README.md` (EN) and `README.zh-CN.md` (中文) must stay in sync when editing docs.
- npm publish shape: the `./tui` export MUST be a compiled ESM file (`dist/index.js`, with `"type": "module"`) — never raw `src/index.tsx`. The host's Solid JSX transform excludes `node_modules` paths (sourceFilter in `@opentui/solid/scripts/solid-plugin.js`), so a TSX entry inside the installed package is silently dropped at load (no plugin-meta.json entry, only a `[tui.plugin]` line on TUI stderr). Build with `@opentui/solid >= 0.4.5` (host bundles 0.5.x) and keep `@opentui/solid*` / `solid-js*` bare imports external — the host rewrites them to its bundled runtime modules at load. Since the host's rewrite regex needs whitespace after `from`/`import` (minified imports are invisible to it and would resolve to solid-js's SSR build and crash rendering), `script/build.mjs` bakes the runtime module ids (`opentui:runtime-module:<encoded-spec>`) into the output at build time instead.
- When changing the published package, test the npm-load path by patching the cache copy at `~/.cache/opencode/packages/opencode-agents-monitor@latest/node_modules/opencode-agents-monitor` (the loader reuses it without revalidating), or reinstall with `opencode plugin opencode-agents-monitor -f` after publishing.
