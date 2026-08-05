<p align="center">
  <picture>
    <source srcset="assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="assets/logo-light.svg" media="(prefers-color-scheme: light)">
    <img src="assets/logo-light.svg" alt="agents logo">
  </picture>
</p>
<p align="center">Keep every OpenCode sub-agent in sight.</p>
<p align="center">
  <a href="https://www.npmjs.com/package/opencode-agents-monitor"><img alt="npm" src="https://img.shields.io/npm/v/opencode-agents-monitor?style=flat-square" /></a>
  <a href="https://github.com/Dqz00116/opencode-agents-monitor/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
</p>
<p align="center">
  English | <a href="README.zh-CN.md">中文</a>
</p>

---

An [OpenCode](https://opencode.ai) TUI plugin that brings live sub-agent progress straight into the session sidebar. See which agents are still working, what each one is doing, and the elapsed time, context, and cost for each, all without leaving your main session.

Expand an agent for its model, current tool, and cost. When you need the full story, open the child session directly from the sidebar.

<p align="center">
  <img src="assets/opencode-agents-monitor.gif" alt="Agents sidebar tracking active and completed OpenCode sub-agents">
</p>

### Why use it?

Once a session fans out across several tasks, it becomes hard to tell what is still moving and what has already finished. The widget keeps that picture visible: active work updates in real time, completed agents move out of the way, and earlier child sessions reappear when the TUI starts.

### What you get

- **Live progress at a glance:** distinguish `thinking`, `tool`, `retry`, `done`, and `idle` states as they change
- **The current tool, while it runs:** see a concise call such as `bash npm test` before it finishes
- **Useful numbers, not noise:** context, elapsed time, model, and cost for each agent
- **A tidy long-running session:** completed agents are sorted into the paginated `Archived (n)` section automatically
- **Details on demand:** keep rows compact, expand the ones you care about, or use `[view]` to open the full child session; press `up` to return
- **History after a restart:** context and elapsed time for earlier agents are restored lazily from the API

### Installation

Requires OpenCode 1.18.0 or later.

```bash
opencode plugin opencode-agents-monitor
```

Restart OpenCode after installation. The widget appears in the session sidebar; press `ctrl+x`, then `b` if the sidebar is hidden.

<details>
<summary>Manual installation</summary>

Add to `~/.config/opencode/tui.json` (global) or `.opencode/tui.json` (project):

```json
{
  "plugin": ["opencode-agents-monitor"]
}
```

</details>

### Usage

| Action | Result |
| --- | --- |
| Click the `Agents` header | Collapse or expand the entire widget (persists) |
| Click an agent row | Show or hide its model, current tool, and cost |
| Click `[view]` | Open the agent's complete child session |
| Click `Archived (n)` | Show or hide completed agents (persists) |
| Click `[<]` / `[>]` | Move through archived pages |

Status markers breathe while an agent is active; `!` means retrying, and `-` means idle or done.

### How it works

- Uses the TUI's official `sidebar_content` slot, the same extension point as the built-in Context and Todo widgets. No host patching required.
- Finds child sessions (`parentID`) from `session.created`, `session.updated`, and `session.deleted` events, plus one initial `session.list()` call.
- Combines `session.status` events (`busy` / `retry` / `idle`) with the shared message store to show live state and the latest tool call.
- Fetches `session.messages` once for completed agents when needed, restoring context size and elapsed time for historical sessions.
- Keeps widget state outside the slot component tree, so slot re-renders do not reset your expanded and archived preferences.

### Development

```bash
git clone https://github.com/Dqz00116/opencode-agents-monitor
cd opencode-agents-monitor
bun install
```

Reference the source from `tui.json` while developing locally:

```json
{
  "plugin": ["./path/to/opencode-agents-monitor/src/index.tsx"]
}
```

After changing the logo source, regenerate both variants with `node script/logo.mjs`.

### Publishing

The npm package must ship a compiled ESM entry. The host only applies its Solid JSX transform outside `node_modules`, so exporting raw `src/index.tsx` would cause the plugin to be skipped during loading.

```bash
bun install
bun run build # writes dist/index.js
```

Run `npm publish` after `npm login`. The source-based file-plugin setup above remains the recommended local development flow.

### License

MIT
