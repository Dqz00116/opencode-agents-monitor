<p align="center">
  <picture>
    <source srcset="assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
    <source srcset="assets/logo-light.svg" media="(prefers-color-scheme: light)">
    <img src="assets/logo-light.svg" alt="agents logo">
  </picture>
</p>
<p align="center">让每个 OpenCode 子代理的进度都清晰可见。</p>
<p align="center">
  <a href="https://www.npmjs.com/package/opencode-agents-monitor"><img alt="npm" src="https://img.shields.io/npm/v/opencode-agents-monitor?style=flat-square" /></a>
  <a href="https://github.com/Dqz00116/opencode-agents-monitor/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" /></a>
</p>
<p align="center">
  <a href="README.md">English</a> | 中文
</p>

---

一个 [OpenCode](https://opencode.ai) TUI 插件，把子代理的实时进度直接放进会话侧栏。哪些代理还在工作、各自在做什么，以及每个代理的耗时、上下文和费用，都能留在主会话中一目了然。

点击代理即可查看模型、当前工具和费用；真正需要完整细节时，再从侧栏直接进入对应的子会话。

<p align="center">
  <img src="assets/opencode-agents-monitor.gif" alt="Agents 侧栏正在追踪活动与已完成的 OpenCode 子代理">
</p>

### 为什么需要它？

当一个会话同时派出多个任务，很快就会难以分辨哪些仍在推进、哪些已经结束。这个组件会把整体进度留在侧栏：活动状态实时更新，完成的代理自动收起，TUI 启动前已有的子会话也会重新显示。

### 你会得到

- **一眼看清实时进度：** 随状态变化区分 `thinking`、`tool`、`retry`、`done` 和 `idle`
- **工具还在运行时就能看到：** 在调用结束前显示 `bash npm test` 这样的简要信息
- **只展示真正有用的数据：** 每个代理的上下文、耗时、模型和费用
- **长会话也保持整洁：** 完成的代理会自动进入支持分页的 `Archived (n)` 区域
- **需要时再看细节：** 平时保持紧凑，点击展开关注的代理，或通过 `[view]` 打开完整子会话；按 `up` 即可返回
- **重启后仍有历史信息：** 通过 API 按需补齐已有代理的上下文与耗时

### 兼容性

两条版本线使用不同的插件 API，互不通用：`0.2.x` 面向 OpenCode v2 API（`@opencode/plugin@2`、`Plugin.define`），`0.1.2` 则是最后一个基于 v1 插件形态（`@opencode-ai/plugin/tui`）的版本。

| 插件版本 | OpenCode 版本 | 安装方式 | 配置文件 |
| --- | --- | --- | --- |
| `0.2.x`（`latest`） | v2（`2.0.0+`） | `opencode plugin add opencode-agents-monitor` | 全局 `~/.config/opencode/cli.json` → `"plugins"` |
| `0.1.2`（legacy，`opencode-v1` dist-tag） | v1（`1.18.0+`） | `opencode plugin opencode-agents-monitor@0.1.2` | `tui.json` → `"plugin"`（全局或项目级） |

npm 上 `latest` 跟随 `0.2.x` 版本线，`0.1.2` 则保留在 `opencode-v1` dist-tag 下。

### 安装

#### OpenCode v2

```bash
opencode plugin add opencode-agents-monitor
```

也可以手动写入全局 `~/.config/opencode/cli.json`。v2 的 TUI 插件只在这里配置，不再读取 `tui.json`：

```json
{
  "plugins": ["opencode-agents-monitor"]
}
```

安装后重启 OpenCode。组件会出现在会话侧栏中；如果侧栏处于隐藏状态，先按 `ctrl+x`，再按 `b` 打开。

<details>
<summary>OpenCode v1（legacy）</summary>

OpenCode v1 通过 `tui.json` 的 `"plugin"` 数组加载 TUI 插件，并且需要 `0.1.2` 这个版本，请显式锁定版本号：

```bash
opencode plugin opencode-agents-monitor@0.1.2
```

在 `~/.config/opencode/tui.json`（全局）或 `.opencode/tui.json`（项目级）中添加：

```json
{
  "plugin": ["opencode-agents-monitor@0.1.2"]
}
```

`opencode-v1` dist-tag 发布后，`opencode-agents-monitor@opencode-v1` 会指向同一版本，可用来替代上面固定的版本号。

</details>

### 使用

| 操作 | 效果 |
| --- | --- |
| 点击 `Agents` 标题 | 折叠或展开整个组件（状态持久化） |
| 点击代理行 | 显示或隐藏模型、当前工具和费用 |
| 点击 `[view]` | 打开该代理的完整子会话 |
| 点击 `Archived (n)` | 显示或隐藏已完成的代理（状态持久化） |
| 点击 `[<]` / `[>]` | 翻页查看已归档代理 |

代理活动时状态标记会循环变化；`!` 表示正在重试，`-` 表示空闲或已完成。

### 工作原理

- 使用 TUI 官方的 `sidebar_content` 插槽，与内置 Context、Todo 组件共用同一扩展点，无需修改宿主代码
- 通过 `session.created`、`session.updated`、`session.deleted` 事件以及一次初始 `session.list()` 调用，追踪由 `parentID` 关联的子会话
- 结合 `session.status` 事件（`busy` / `retry` / `idle`）和共享消息存储，显示实时状态与最近一次工具调用
- 在需要时为已完成的代理读取一次 `session.messages`，补齐历史会话的上下文与耗时
- 将组件状态保存在插槽组件树之外，因此插槽重渲染不会重置展开与归档偏好

### 开发

```bash
git clone https://github.com/Dqz00116/opencode-agents-monitor
cd opencode-agents-monitor
bun install
```

#### OpenCode v2

在全局 `~/.config/opencode/cli.json` 中指向本仓库目录：

```json
{
  "plugins": ["/path/to/opencode-agents-monitor"]
}
```

使用本地路径时，v2 会解析仓库根目录下物理存在的 `tui.js`，它再导出构建产物 `dist/index.js`；因此修改源码后需要运行 `bun run build`。

#### OpenCode v1（legacy）

v1 的做法是在 `tui.json` 中直接引用源文件：

```json
{
  "plugin": ["./path/to/opencode-agents-monitor/src/index.tsx"]
}
```

该方式仅适用于 v1 源码线；从 `0.2.0` 起源码已迁移到 v2 API，如需调试 v1 插件请使用 `0.1.2` 版本。

修改 Logo 源码后，运行 `node script/logo.mjs` 重新生成亮色和暗色版本。

### 发布

发布到 npm 的包必须包含编译后的 ESM 入口。宿主只对 `node_modules` 之外的文件应用 Solid JSX 转换，因此直接导出原始 `src/index.tsx` 会导致插件在加载时被跳过。

```bash
bun install
bun run build # 生成 dist/index.js
```

先运行 `npm login`，再执行 `npm publish`。`0.2.0` 发布到 `latest` dist-tag，v1 版本线则发布在 `opencode-v1` 下：

```bash
npm dist-tag add opencode-agents-monitor@0.1.2 opencode-v1
```

本地开发时，v2 请使用上面的 `tui.js` 路径方式，v1 版本线仍使用 `tui.json` 源文件方式。

### 许可证

MIT
