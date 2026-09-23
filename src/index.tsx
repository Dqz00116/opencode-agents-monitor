/** @jsxImportSource @opentui/solid */
import type { SessionInfo, SessionMessageAssistant, SessionMessageAssistantTool } from "@opencode/client"
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { createEffect, createMemo, createRoot, createSignal, For, onCleanup, Show } from "solid-js"

type Context = ReturnType<typeof usePlugin>

type Run = { start: number; end?: number }

const STORAGE_KEY = "agents_sidebar"
const ARCHIVED_PAGE_SIZE = 10

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

type Tracker = {
  active: (parentID: string) => SessionInfo[]
  archived: (parentID: string) => SessionInfo[]
  run: (sessionID: string) => Run | undefined
  now: () => number
  breathing: () => number
  collapsed: () => boolean
  toggleCollapsed: () => void
  showArchived: () => boolean
  toggleArchived: () => void
  expanded: (sessionID: string, fallback: boolean) => boolean
  toggleExpanded: (sessionID: string, fallback: boolean) => void
  archivedPage: (sessionID: string) => number
  setArchivedPage: (sessionID: string, page: number) => void
}

function agentName(session: SessionInfo) {
  const hit = (session.title ?? "").match(/\(@([^\s()]+)\s+subagent\)\s*$/)
  const name = hit?.[1] ?? session.agent ?? "agent"
  return name.length > 10 ? `${name.slice(0, 9)}~` : name
}

function agentDesc(session: SessionInfo) {
  const desc = (session.title ?? "").replace(/\s*\(@[^\s()]+\s+subagent\)\s*$/, "")
  return desc.length > 38 ? `${desc.slice(0, 37)}~` : desc
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m`
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return `${value}`
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function toolSummary(part: SessionMessageAssistantTool) {
  const input: Record<string, unknown> = part.state.status === "streaming" ? {} : part.state.input
  const detail =
    input.command ??
    input.description ??
    input.filePath ??
    input.path ??
    input.pattern ??
    input.query ??
    input.url ??
    ""
  const text = detail ? `${part.name} ${String(detail)}` : part.name
  return text.length > 30 ? `${text.slice(0, 29)}~` : text
}

function createTracker(context: Context): { tracker: Tracker; dispose: () => void } {
  return createRoot((dispose) => {
    const [ui, setUi] = context.storage.store(STORAGE_KEY, {
      initial: { collapsed: true, showArchived: false },
    })
    const [runs, setRuns] = createSignal<Record<string, Run>>({})
    const [now, setNow] = createSignal(Date.now())
    const [breathing, setBreathing] = createSignal(0)
    const [expandedMap, setExpandedMap] = createSignal<Record<string, boolean>>({})
    const [archivedPageMap, setArchivedPageMap] = createSignal<Record<string, number>>({})
    const hydrated = new Set<string>()

    function isDone(session: SessionInfo) {
      if (context.data.session.status(session.id) === "running") return false
      if (runs()[session.id]?.end !== undefined) return true
      return now() - session.time.created >= 30_000
    }

    function hydrate(sessionID: string) {
      if (hydrated.has(sessionID)) return
      hydrated.add(sessionID)
      void context.data.session.message.sync(sessionID).catch(() => {})
    }

    // Seed subagents that predate the TUI: they are absent from the client data
    // store until something syncs them by id.
    void context.client.session
      .list({})
      .then((response) => {
        for (const session of response.data ?? []) {
          if (!session.parentID) continue
          if (context.data.session.get(session.id)) continue
          void context.data.session.sync(session.id).catch(() => {})
        }
      })
      .catch(() => {})

    const timer = setInterval(() => setNow(Date.now()), 1000)
    const breathingTimer = setInterval(() => setBreathing((value) => value + 1), 400)
    onCleanup(() => {
      clearInterval(timer)
      clearInterval(breathingTimer)
    })

    createEffect(() => {
      for (const child of context.data.session.list()) {
        if (!child.parentID) continue
        const busy = context.data.session.status(child.id) === "running"
        setRuns((current) => {
          const run = current[child.id]
          if (busy && (!run || run.end !== undefined)) return { ...current, [child.id]: { start: Date.now() } }
          if (!busy && run && run.end === undefined) return { ...current, [child.id]: { ...run, end: Date.now() } }
          return current
        })
        if (!busy && context.data.session.message.list(child.id).length === 0) hydrate(child.id)
      }
    })

    return {
      dispose,
      tracker: {
        active(parentID) {
          return context.data.session
            .list()
            .filter((session) => session.parentID === parentID && !isDone(session))
            .sort((a, b) => a.time.created - b.time.created)
        },
        archived(parentID) {
          return context.data.session
            .list()
            .filter((session) => session.parentID === parentID && isDone(session))
            .sort((a, b) => (runs()[b.id]?.end ?? b.time.updated) - (runs()[a.id]?.end ?? a.time.updated))
        },
        run(sessionID) {
          return runs()[sessionID]
        },
        now,
        breathing,
        collapsed() {
          return ui.collapsed
        },
        toggleCollapsed() {
          void setUi((draft) => {
            draft.collapsed = !draft.collapsed
          })
        },
        showArchived() {
          return ui.showArchived
        },
        toggleArchived() {
          void setUi((draft) => {
            draft.showArchived = !draft.showArchived
          })
        },
        expanded(sessionID, fallback) {
          return expandedMap()[sessionID] ?? fallback
        },
        toggleExpanded(sessionID, fallback) {
          const next = !(expandedMap()[sessionID] ?? fallback)
          setExpandedMap((current) => ({ ...current, [sessionID]: next }))
        },
        archivedPage(sessionID) {
          const total = context.data.session
            .list()
            .filter((session) => session.parentID === sessionID && isDone(session)).length
          const pages = Math.max(1, Math.ceil(total / ARCHIVED_PAGE_SIZE))
          return Math.min(archivedPageMap()[sessionID] ?? 0, pages - 1)
        },
        setArchivedPage(sessionID, page) {
          const total = context.data.session
            .list()
            .filter((session) => session.parentID === sessionID && isDone(session)).length
          const pages = Math.max(1, Math.ceil(total / ARCHIVED_PAGE_SIZE))
          const clamped = Math.max(0, Math.min(page, pages - 1))
          setArchivedPageMap((current) => ({ ...current, [sessionID]: clamped }))
        },
      },
    }
  })
}

function Agent(props: { tracker: Tracker; session: SessionInfo }) {
  const context = usePlugin()
  const theme = () => context.theme

  const status = createMemo(() => context.data.session.status(props.session.id))
  const messages = createMemo(() => context.data.session.message.list(props.session.id))
  const lastAssistant = createMemo(() =>
    messages().findLast((item): item is SessionMessageAssistant => item.type === "assistant"),
  )
  const running = createMemo(() =>
    (lastAssistant()?.content ?? []).some(
      (item) => item.type === "tool" && (item.state.status === "running" || item.state.status === "streaming"),
    ),
  )
  const tool = createMemo(() =>
    lastAssistant()?.content.findLast((item): item is SessionMessageAssistantTool => item.type === "tool"),
  )
  const state = createMemo(() => {
    if (status() === "running") {
      if (running()) return { label: "tool", color: theme().text.feedback.warning.base }
      return { label: "thinking", color: theme().hue.accent[200] }
    }
    if (lastAssistant()?.finish) return { label: "done", color: theme().text.muted }
    return { label: "idle", color: theme().text.muted }
  })
  const stateAbbr = createMemo(() => {
    const table: Record<string, string> = {
      thinking: "think",
      tool: "tool",
      done: "done",
      idle: "idle",
    }
    return table[state().label] ?? state().label
  })
  const model = createMemo(() => lastAssistant()?.model.id ?? props.session.model?.id ?? "?")
  const ctx = createMemo(() => {
    const item = messages().findLast(
      (message): message is SessionMessageAssistant =>
        message.type === "assistant" && (message.tokens?.output ?? 0) > 0,
    )
    const tokens = item?.tokens
    if (!tokens) return undefined
    return tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
  })
  const elapsedMs = createMemo(() => {
    const run = props.tracker.run(props.session.id)
    if (run) return (run.end ?? props.tracker.now()) - run.start
    const last = lastAssistant()
    const end = last?.time.completed ?? last?.time.created ?? props.session.time.updated
    return end > props.session.time.created ? end - props.session.time.created : undefined
  })
  const open = createMemo(() => props.tracker.expanded(props.session.id, false))

  // Breathing indicator (ASCII only), driven by the tracker's 400ms `breathing` tick.
  const phase = createMemo(() => props.tracker.breathing() % 4)
  const indicator = createMemo(() => {
    const label = state().label
    if (label === "thinking" || label === "tool") return [".", "o", "O", "o"][phase()]
    return "-"
  })

  return (
    <box marginBottom={1}>
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => props.tracker.toggleExpanded(props.session.id, false)}
        >
          <text fg={state().color}>{indicator()}</text>
          <text fg={theme().text.base}>
            <b>[{agentName(props.session)}]</b>
          </text>
          <text fg={theme().text.muted}>
            {stateAbbr()} {ctx() !== undefined ? formatTokens(ctx()!) : "-"}{" "}
            {elapsedMs() !== undefined ? formatElapsed(elapsedMs()!) : "-"}
          </text>
        </box>
        <box onMouseDown={() => context.ui.router.navigate({ type: "session", sessionID: props.session.id })}>
          <text fg={theme().hue.interactive[200]}>[view]</text>
        </box>
      </box>
      <text fg={theme().text.muted}>  {agentDesc(props.session)}</text>
      <Show when={open()}>
        <text fg={theme().text.muted}>  model: {model()}</text>
        <text fg={theme().text.muted}>  tool: {tool() ? toolSummary(tool()!) : "-"}</text>
        <text fg={theme().text.muted}>  cost: {money.format(props.session.cost ?? 0)}</text>
      </Show>
    </box>
  )
}

function View(props: { tracker: Tracker; session_id: string }) {
  const context = usePlugin()
  const theme = () => context.theme
  const active = createMemo(() => props.tracker.active(props.session_id))
  const archived = createMemo(() => props.tracker.archived(props.session_id))
  const total = () => active().length + archived().length
  const archivedTotalPages = createMemo(() => Math.max(1, Math.ceil(archived().length / ARCHIVED_PAGE_SIZE)))
  const archivedPage = createMemo(() => props.tracker.archivedPage(props.session_id))
  const archivedItems = createMemo(() => {
    const start = archivedPage() * ARCHIVED_PAGE_SIZE
    return archived().slice(start, start + ARCHIVED_PAGE_SIZE)
  })

  return (
    <box marginBottom={1}>
      <box flexDirection="row" gap={1} onMouseDown={() => props.tracker.toggleCollapsed()}>
        <text fg={theme().text.base}>{props.tracker.collapsed() ? "▶" : "▼"}</text>
        <text fg={theme().text.base}>
          <b>Agents</b>
        </text>
        <text fg={theme().text.muted}>
          {active().length} active {archived().length} done
        </text>
      </box>
      <Show when={!props.tracker.collapsed()}>
        <Show when={total() > 0} fallback={<text fg={theme().text.muted}>No subagents yet</text>}>
          <For each={active()}>
            {(child) => <Agent tracker={props.tracker} session={child} />}
          </For>
          <Show when={archived().length > 0}>
            <box flexDirection="row" gap={1} onMouseDown={() => props.tracker.toggleArchived()}>
              <text fg={theme().text.muted}>{props.tracker.showArchived() ? "▼" : "▶"}</text>
              <text fg={theme().text.muted}>Archived ({archived().length})</text>
            </box>
            <Show when={props.tracker.showArchived()}>
              <For each={archivedItems()}>
                {(child) => <Agent tracker={props.tracker} session={child} />}
              </For>
              <Show when={archivedTotalPages() > 1}>
                <box flexDirection="row" gap={1}>
                  <text
                    fg={archivedPage() > 0 ? theme().hue.interactive[200] : theme().text.muted}
                    onMouseDown={() => props.tracker.setArchivedPage(props.session_id, archivedPage() - 1)}
                  >
                    [&lt;]
                  </text>
                  <text fg={theme().text.muted}>
                    {archivedPage() + 1}/{archivedTotalPages()}
                  </text>
                  <text
                    fg={archivedPage() < archivedTotalPages() - 1 ? theme().hue.interactive[200] : theme().text.muted}
                    onMouseDown={() => props.tracker.setArchivedPage(props.session_id, archivedPage() + 1)}
                  >
                    [&gt;]
                  </text>
                </box>
              </Show>
            </Show>
          </Show>
        </Show>
      </Show>
    </box>
  )
}

export default Plugin.define({
  id: "agents-sidebar",
  setup(context) {
    const { tracker, dispose } = createTracker(context)
    const remove = context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }) => <View tracker={tracker} session_id={sessionID} />,
    })
    return () => {
      remove()
      dispose()
    }
  },
})
