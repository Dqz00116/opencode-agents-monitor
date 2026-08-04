/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Session } from "@opencode-ai/sdk/v2"
import { createEffect, createMemo, createRoot, createSignal, For, Show } from "solid-js"

type Run = { start: number; end?: number }

const KV_COLLAPSED = "agents_sidebar.collapsed"
const KV_ARCHIVED = "agents_sidebar.show_archived"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

type Tracker = {
  active: (parentID: string) => Session[]
  archived: (parentID: string) => Session[]
  run: (sessionID: string) => Run | undefined
  history: (sessionID: string) => History | undefined
  now: () => number
  collapsed: () => boolean
  toggleCollapsed: () => void
  showArchived: () => boolean
  toggleArchived: () => void
  expanded: (sessionID: string, fallback: boolean) => boolean
  toggleExpanded: (sessionID: string, fallback: boolean) => void
}

type History = { ctx?: number; elapsed?: number }

function agentName(session: Session) {
  const hit = session.title.match(/\(@([^\s()]+)\s+subagent\)\s*$/)
  const name = hit?.[1] ?? session.agent ?? "agent"
  return name.length > 10 ? `${name.slice(0, 9)}~` : name
}

function agentDesc(session: Session) {
  const desc = session.title.replace(/\s*\(@[^\s()]+\s+subagent\)\s*$/, "")
  return desc.length > 30 ? `${desc.slice(0, 29)}~` : desc
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

function toolSummary(part: { tool: string; state: { input: Record<string, unknown> } }) {
  const input = part.state.input ?? {}
  const detail =
    input.command ??
    input.description ??
    input.filePath ??
    input.path ??
    input.pattern ??
    input.query ??
    input.url ??
    ""
  const text = detail ? `${part.tool} ${String(detail)}` : part.tool
  return text.length > 30 ? `${text.slice(0, 29)}~` : text
}

function createTracker(api: TuiPluginApi): Tracker {
  return createRoot((dispose) => {
    const [sessions, setSessions] = createSignal<Record<string, Session>>({})
    const [runs, setRuns] = createSignal<Record<string, Run>>({})
    const [history, setHistory] = createSignal<Record<string, History>>({})
    const hydrated = new Set<string>()
    const [now, setNow] = createSignal(Date.now())
    const [collapsed, setCollapsed] = createSignal(!!api.kv.get(KV_COLLAPSED, true))
    const [showArchived, setShowArchived] = createSignal(!!api.kv.get(KV_ARCHIVED, false))
    const [expandedMap, setExpandedMap] = createSignal<Record<string, boolean>>({})

    function track(session: Session) {
      if (!session.parentID) return
      setSessions((current) => {
        const prev = current[session.id]
        if (prev && prev.title === session.title && prev.time.updated === session.time.updated) return current
        return { ...current, [session.id]: session }
      })
    }

    function isDone(session: Session) {
      const status = api.state.session.status(session.id)
      if (status) return status.type === "idle"
      return now() - session.time.created >= 30_000
    }

    async function hydrate(session: Session) {
      if (hydrated.has(session.id)) return
      hydrated.add(session.id)
      try {
        const res = await api.client.session.messages({ sessionID: session.id, limit: 10 })
        const list = (res.data ?? []) as Array<{ info: AssistantMessage }>
        const assistants = list.map((item) => item.info).filter((item) => item.role === "assistant")
        const withTokens = assistants.findLast((item) => item.tokens && item.tokens.output > 0)
        const ctx = withTokens
          ? withTokens.tokens.input +
            withTokens.tokens.output +
            withTokens.tokens.reasoning +
            withTokens.tokens.cache.read +
            withTokens.tokens.cache.write
          : undefined
        const last = assistants[assistants.length - 1]
        const end = last?.time.completed ?? last?.time.created ?? session.time.updated
        const elapsed = end > session.time.created ? end - session.time.created : undefined
        setHistory((current) => ({ ...current, [session.id]: { ctx, elapsed } }))
      } catch {}
    }

    api.event.on("session.created", (event) => track(event.properties.info))
    api.event.on("session.updated", (event) => track(event.properties.info))
    api.event.on("session.deleted", (event) =>
      setSessions((current) => {
        if (!(event.properties.info.id in current)) return current
        const next = { ...current }
        delete next[event.properties.info.id]
        return next
      }),
    )

    void api.client.session
      .list({})
      .then((res) => {
        for (const session of res.data ?? []) track(session)
      })
      .catch(() => {})

    const timer = setInterval(() => setNow(Date.now()), 1000)

    createEffect(() => {
      for (const child of Object.values(sessions())) {
        const status = api.state.session.status(child.id)
        const busy = status?.type === "busy" || status?.type === "retry"
        setRuns((current) => {
          const run = current[child.id]
          if (busy && (!run || run.end !== undefined)) return { ...current, [child.id]: { start: Date.now() } }
          if (status?.type === "idle" && run && run.end === undefined)
            return { ...current, [child.id]: { ...run, end: Date.now() } }
          return current
        })
        const settled = status?.type === "idle" || (!status && Date.now() - child.time.created >= 30_000)
        if (settled && api.state.session.messages(child.id).length === 0) void hydrate(child)
      }
    })

    api.lifecycle.onDispose(dispose)

    return {
      active(parentID) {
        return Object.values(sessions())
          .filter((session) => session.parentID === parentID && !isDone(session))
          .sort((a, b) => a.time.created - b.time.created)
      },
      archived(parentID) {
        return Object.values(sessions())
          .filter((session) => session.parentID === parentID && isDone(session))
          .sort((a, b) => (runs()[b.id]?.end ?? b.time.updated) - (runs()[a.id]?.end ?? a.time.updated))
      },
      run(sessionID) {
        return runs()[sessionID]
      },
      history(sessionID) {
        return history()[sessionID]
      },
      now,
      collapsed,
      toggleCollapsed() {
        const next = !collapsed()
        setCollapsed(next)
        api.kv.set(KV_COLLAPSED, next)
      },
      showArchived,
      toggleArchived() {
        const next = !showArchived()
        setShowArchived(next)
        api.kv.set(KV_ARCHIVED, next)
      },
      expanded(sessionID, fallback) {
        return expandedMap()[sessionID] ?? fallback
      },
      toggleExpanded(sessionID, fallback) {
        const next = !(expandedMap()[sessionID] ?? fallback)
        setExpandedMap((current) => ({ ...current, [sessionID]: next }))
      },
    }
  })
}

function Agent(props: { api: TuiPluginApi; tracker: Tracker; session: Session }) {
  const api = props.api
  const theme = () => api.theme.current

  const status = createMemo(() => api.state.session.status(props.session.id))
  const messages = createMemo(() => api.state.session.messages(props.session.id))
  const lastAssistant = createMemo(() =>
    messages().findLast((item): item is AssistantMessage => item.role === "assistant"),
  )
  const parts = createMemo(() => {
    const last = messages()[messages().length - 1]
    return last ? api.state.part(last.id) : []
  })
  const running = createMemo(() =>
    parts().some(
      (item) => item.type === "tool" && (item.state.status === "running" || item.state.status === "pending"),
    ),
  )
  const tool = createMemo(() => {
    const part = parts().findLast((item) => item.type === "tool")
    return part as { tool: string; state: { status: string; input: Record<string, unknown> } } | undefined
  })
  const state = createMemo(() => {
    const current = status()
    if (current?.type === "retry") return { label: "retry", color: theme().error }
    if (current?.type === "busy") {
      if (running()) return { label: "tool", color: theme().warning }
      return { label: "thinking", color: theme().accent }
    }
    if (lastAssistant()?.finish) return { label: "done", color: theme().textMuted }
    return { label: "idle", color: theme().textMuted }
  })
  const model = createMemo(() => lastAssistant()?.modelID ?? props.session.model?.id ?? "?")
  const ctx = createMemo(() => {
    const item = messages().findLast(
      (x): x is AssistantMessage => x.role === "assistant" && x.tokens.output > 0,
    )
    if (item) {
      return (
        item.tokens.input +
        item.tokens.output +
        item.tokens.reasoning +
        item.tokens.cache.read +
        item.tokens.cache.write
      )
    }
    return props.tracker.history(props.session.id)?.ctx
  })
  const elapsedMs = createMemo(() => {
    const run = props.tracker.run(props.session.id)
    if (run) return (run.end ?? props.tracker.now()) - run.start
    return props.tracker.history(props.session.id)?.elapsed
  })
  const open = createMemo(() => props.tracker.expanded(props.session.id, false))
  const idle = () => state().label === "done" || state().label === "idle"
  const summary = createMemo(() =>
    [
      state().label,
      elapsedMs() !== undefined ? formatElapsed(elapsedMs()!) : undefined,
    ]
      .filter(Boolean)
      .join(" "),
  )

  return (
    <box marginBottom={1}>
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => props.tracker.toggleExpanded(props.session.id, false)}
        >
          <text fg={state().color}>{state().label.startsWith("retry") ? "!" : idle() ? "-" : "*"}</text>
          <text fg={theme().text}>
            <b>[{agentName(props.session)}]</b>
          </text>
          <Show when={!open()}>
            <text fg={theme().textMuted}>{summary()}</text>
          </Show>
        </box>
        <box onMouseDown={() => api.route.navigate("session", { sessionID: props.session.id })}>
          <text fg={theme().primary}>[view]</text>
        </box>
      </box>
      <Show when={open()}>
        <box flexDirection="row" gap={1}>
          <text fg={theme().textMuted}>state:</text>
          <text fg={state().color}>{state().label}</text>
        </box>
        <text fg={theme().textMuted}>model: {model()}</text>
        <text fg={theme().textMuted}>ctx: {ctx() !== undefined ? formatTokens(ctx()!) : "-"}</text>
        <text fg={theme().textMuted}>tool: {tool() ? toolSummary(tool()!) : "-"}</text>
        <text fg={theme().textMuted}>
          elapsed: {elapsedMs() !== undefined ? formatElapsed(elapsedMs()!) : "-"}
        </text>
        <text fg={theme().textMuted}>desc: {agentDesc(props.session)}</text>
        <text fg={theme().textMuted}>cost: {money.format(props.session.cost ?? 0)}</text>
      </Show>
    </box>
  )
}

function View(props: { api: TuiPluginApi; tracker: Tracker; session_id: string }) {
  const theme = () => props.api.theme.current
  const active = createMemo(() => props.tracker.active(props.session_id))
  const archived = createMemo(() => props.tracker.archived(props.session_id))
  const total = () => active().length + archived().length

  return (
    <box marginBottom={1}>
      <box flexDirection="row" gap={1} onMouseDown={() => props.tracker.toggleCollapsed()}>
        <text fg={theme().text}>{props.tracker.collapsed() ? "▶" : "▼"}</text>
        <text fg={theme().text}>
          <b>Agents</b>
        </text>
        <text fg={theme().textMuted}>
          {active().length} active {archived().length} done
        </text>
      </box>
      <Show when={!props.tracker.collapsed()}>
        <Show when={total() > 0} fallback={<text fg={theme().textMuted}>No subagents yet</text>}>
          <For each={active()}>
            {(child) => <Agent api={props.api} tracker={props.tracker} session={child} />}
          </For>
          <Show when={archived().length > 0}>
            <box flexDirection="row" gap={1} onMouseDown={() => props.tracker.toggleArchived()}>
              <text fg={theme().textMuted}>{props.tracker.showArchived() ? "▼" : "▶"}</text>
              <text fg={theme().textMuted}>Archived ({archived().length})</text>
            </box>
            <Show when={props.tracker.showArchived()}>
              <For each={archived()}>
                {(child) => <Agent api={props.api} tracker={props.tracker} session={child} />}
              </For>
            </Show>
          </Show>
        </Show>
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  const tracker = createTracker(api)
  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} tracker={tracker} session_id={props.session_id} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "agents-sidebar",
  tui,
}

export default plugin
