<p align="center">
  <picture>
    <source srcset="assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="assets/logo-light.svg" media="(prefers-color-scheme: light)">
    <img src="assets/logo-light.svg" alt="agents logo">
  </picture>
</p>
<p align="center">Live sub-agent status in the OpenCode sidebar.</p>
<p align="center">
  <a href="https://www.npmjs.com/package/opencode-agents-sidebar"><img alt="npm" src="https://img.shields.io/npm/v/opencode-agents-sidebar?style=flat-square" /></a>
  <a href="https://github.com/Dqz00116/opencode-agents-sidebar/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
</p>
<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">简体中文</a>
</p>

---

An [OpenCode](https://opencode.ai) TUI plugin that adds an **Agents** widget to the session
sidebar, so you can watch every sub-agent your session spawns — what it's doing, which
model it runs on, how much context it has burned, and how long it has been at it.

```
▼ Agents 2 active 1 done
* [explore] thinking 02:31      [view]
* [coder] tool 00:48            [view]
▶ Archived (1)
```

Click a row to expand the details:

```
* [coder]                       [view]
state: tool
model: claude-sonnet-4-5
ctx: 32k
tool: bash npm test
elapsed: 00:48
desc: Catalog sidebar components
cost: $0.0123
```

### Features

- **Live status per sub-agent** — `thinking` / `tool` / `retry` / `done` / `idle`,
  driven by the server's `session.status` event stream
- **Current tool call** — see `bash npm test` while it's still running
- **Context & cost** — token usage and spend per agent
- **Elapsed timer** — starts when the agent goes busy, freezes when it's done
- **Auto-archive** — finished agents fold into `Archived (n)`, sorted by completion time
- **Click to expand** — rows collapse to a one-line summary by default
- **Jump into the agent** — the `[view]` button opens the agent's own session view
  (same as the built-in "Go to child session"); press `up` to come back
- **History hydration** — agents from before the current TUI was started still get
  `ctx` / `elapsed`, fetched lazily from the API
- **Flicker-free** — fixed-height rows and a fixed-width layout that fits the sidebar

### Installation

```bash
opencode plugin opencode-agents-sidebar
```

Restart OpenCode afterwards. The widget lives in the session sidebar —
press `ctrl+x` then `b` if the sidebar is hidden.

<details>
<summary>Manual installation</summary>

Add to `~/.config/opencode/tui.json` (global) or `.opencode/tui.json` (project):

```json
{
  "plugin": ["opencode-agents-sidebar"]
}
```

</details>

### Usage

| Action | Result |
| --- | --- |
| Click `Agents` header | Collapse / expand the whole widget (persists) |
| Click an agent row | Expand details / collapse to one-line summary |
| Click `[view]` | Open that agent's session (messages, tools, everything) |
| Click `Archived (n)` | Show / hide finished agents (persists) |

Status markers: `*` active · `!` retrying · `-` idle / done.

### How it works

- Registers into the TUI's `sidebar_content` slot — the same extension point the
  built-in Context / Todo widgets use. No patched host code.
- Tracks child sessions (`parentID`) via `session.created` / `session.updated` /
  `session.deleted` events plus one initial `session.list()`.
- Live state comes from `session.status` events (`busy` / `retry` / `idle`) and the
  shared message store; the current tool is the last `tool` part of the latest
  assistant message.
- Finished agents are hydrated once via `session.messages` so historical sessions
  still report context size and elapsed time.
- All widget state lives outside the slot component tree, so the slot registry's
  renderer re-invocation never loses state.

### Development

```bash
git clone https://github.com/Dqz00116/opencode-agents-sidebar
cd opencode-agents-sidebar
bun install
```

Add it to your `tui.json` as a file plugin while hacking:

```json
{
  "plugin": ["./path/to/opencode-agents-sidebar/src/index.tsx"]
}
```

The logo is generated: `node script/logo.mjs` (pixel wordmark in the opencode
ornate style).

### License

MIT
