<p align="center">
  <picture>
    <source srcset="assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="assets/logo-light.svg" media="(prefers-color-scheme: light)">
    <img src="assets/logo-light.svg" alt="agents logo">
  </picture>
</p>
<p align="center">在 OpenCode 侧边栏实时观察子代理的运行状态。</p>
<p align="center">
  <a href="https://www.npmjs.com/package/opencode-agents-monitor"><img alt="npm" src="https://img.shields.io/npm/v/opencode-agents-monitor?style=flat-square" /></a>
  <a href="https://github.com/Dqz00116/opencode-agents-monitor/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
</p>
<p align="center">
  <a href="README.md">English</a> | 中文
</p>

---

一个 [OpenCode](https://opencode.ai) TUI 插件，在会话侧边栏添加 **Agents** 组件，
让你实时掌握当前会话派生的每个子代理：它在做什么、用哪个模型、
烧了多少上下文、已经跑了多久。

**它与众不同之处：** 其他侧边栏插件只是*列出*你的代理——这个插件展示的是它们**此刻正在做什么**。实时的 `session.status` 事件驱动五种状态（`thinking` / `tool` / `retry` / `done` / `idle`），**当前工具调用**在运行期间即可实时可见，而 TUI 启动之前就已结束的代理也会通过 API **水合（hydrated）**，因此上下文与耗时信息永不丢失。

<p align="center">
  <img src="assets/opencode-agents-monitor.gif" alt="opencode-agents-monitor 演示">
</p>

### 特性

- **实时状态** — `thinking` / `tool` / `retry` / `done` / `idle`，
  由服务端 `session.status` 事件流驱动
- **当前工具调用** — 工具还在跑就能看到，如 `bash npm test`
- **上下文与花费** — 每个代理的 token 用量和成本
- **耗时计时** — 代理进入 busy 开始计时，完成后冻结
- **自动归档** — 已完成的代理折叠进 `Archived (n)`，按完成时间倒序
- **点击展开** — 行默认折叠为单行概况，点击查看详情
- **跳进代理会话** — `[view]` 按钮直达该代理自己的会话视图
  （等同内置的 "Go to child session"），按 `up` 返回
- **历史数据水合** — 重启 TUI 之前的代理也能显示 `ctx` / `elapsed`，
  通过 API 惰性拉取一次
- **稳定不闪动** — 定高行 + 适配侧栏宽度的定宽布局

### 安装

```bash
opencode plugin opencode-agents-monitor
```

安装后重启 OpenCode。组件位于会话侧边栏——
如果侧栏处于隐藏状态，按 `ctrl+x` 再按 `b` 打开。

<details>
<summary>手动安装</summary>

在 `~/.config/opencode/tui.json`（全局）或 `.opencode/tui.json`（项目级）中添加：

```json
{
  "plugin": ["opencode-agents-monitor"]
}
```

</details>

### 使用

| 操作 | 效果 |
| --- | --- |
| 点击 `Agents` 标题 | 折叠 / 展开整个组件（状态持久化） |
| 点击代理行 | 展开详情 / 折叠为单行概况 |
| 点击 `[view]` | 打开该代理的会话（消息、工具调用全过程） |
| 点击 `Archived (n)` | 显示 / 隐藏已完成的代理（状态持久化） |

状态标记：`*` 活动中 · `!` 重试中 · `-` 空闲 / 已完成。

### 工作原理

- 注册到 TUI 的 `sidebar_content` 插槽——与内置 Context / Todo 组件
  相同的扩展点，无需修改宿主代码
- 通过 `session.created` / `session.updated` / `session.deleted` 事件
  及一次初始 `session.list()` 追踪子会话（`parentID` 关联）
- 实时状态来自 `session.status` 事件（`busy` / `retry` / `idle`）与共享
  消息存储；当前工具取最新一条 assistant 消息的最后一个 `tool` part
- 已结束的代理通过 `session.messages` 一次性水合，历史会话也能报告
  上下文大小与耗时
- 组件全部状态保存在插槽组件树之外，插槽注册表重渲染不会丢失状态

### 开发

```bash
git clone https://github.com/Dqz00116/opencode-agents-monitor
cd opencode-agents-monitor
bun install
```

开发时在 `tui.json` 中以文件插件方式引用：

```json
{
  "plugin": ["./path/to/opencode-agents-monitor/src/index.tsx"]
}
```

Logo 由脚本生成：`node script/logo.mjs`（opencode ornate 风格的像素字标）。

### 许可证

MIT
