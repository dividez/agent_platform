# Agent Platform 路线图

## 1. 项目定位

本项目的目标不是 ChatBot、Dify Clone、Workflow Builder 或 Prompt Playground，而是一个 **Browser-based Agent Operating Platform**。

平台核心能力包括：

- Browser Workspace
- Agent Runtime
- Runtime Event System
- Artifact System
- HITL Runtime
- Protocol Layer
- Sandbox Compute Layer
- Tool Runtime

路线图主线是：

> 先做一个可跑通的“事件驱动 Agent Run 垂直闭环”，再把 Runtime、Artifact、HITL、Sandbox、Provider、Adapter 逐层产品化。

## 2. 当前状态判断

### 已具备的基础

- Monorepo 骨架已经搭建，包含 `apps/web`、`apps/api` 与多个平台包。
- `packages/protocol` 已有最小 Runtime Event 类型集合。
- `packages/artifact` 已有 Artifact 类型集合。
- `packages/runtime` 已有 `RuntimeEventBus` 与 `AgentRuntime` 抽象。
- `packages/db`、`packages/memory`、`packages/storage` 已开始 Provider 抽象。
- `apps/api` 已提供 health、runtime event types、infra providers 等基础端点。
- `apps/web` 已有基础 Workspace 页面。
- `docker-compose.yaml` 已包含 web、api、postgres、redis、temporal、qdrant、minio 等基础设施。
- `agents/contract-review` 与 `agents/compare-review` 已有初始 Agent 定义。

### 主要短板

- Runtime 还缺少真实 run 状态机、事件存储、异步执行、恢复、取消、重试与 checkpoint。
- Runtime Event payload 仍是 `unknown`，缺少强类型事件契约。
- Artifact 还没有生命周期、持久化、版本与独立 API。
- HITL 还没有审批会话、暂停/恢复 Runtime、审批 UI 与审计链路。
- Tool Runtime 还缺少 registry、权限、审计、沙箱、schema validation 与 MCP bridge。
- Sandbox Provider 还缺少 session、文件系统、资源限制、网络策略与安全策略。
- Agent YAML 还没有被 Runtime loader、tool registry、HITL 与 renderer 真正消费。

## 3. 路线图阶段

## Phase 0：工程基线与可信启动

目标：把项目从“架构骨架”变成“每次改动都能验证”的工程状态。

### 重点任务

1. 补齐 lockfile 与依赖安装基线。
2. 确认以下命令可用：
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm build`
   - `pnpm migrations:check`
3. 建立 CI，至少运行 typecheck、lint、build、migration check。
4. 确认 `docker compose up --build` 是统一本地启动入口。
5. 明确各 package 边界，避免继续无约束拆包。

### 验收标准

- API 能启动并返回 `/health`。
- Web 能启动并展示 Runtime Event Protocol。
- 根目录脚本全部可跑。
- CI 失败时可以明确定位到 package。

## Phase 1：第一个 Agent Run 垂直闭环

目标：跑通平台最小核心链路。

```text
Web 输入 prompt
  -> API 创建 run
  -> Runtime 发布事件
  -> Web 订阅事件
  -> Runtime 生成 artifact
  -> run finished
```

### 重点任务

1. 将 Runtime Events 升级为强类型 discriminated union：
   - `RunStartedEvent`
   - `MessageDeltaEvent`
   - `ToolCallStartedEvent`
   - `ToolCallFinishedEvent`
   - `ArtifactCreatedEvent`
   - `HitlRequiredEvent`
   - `RunFinishedEvent`
   - `RunFailedEvent`
2. 实现 `InMemoryRunStore`。
3. 实现 `InMemoryEventBus`。
4. 实现 `MockAgentRuntime`。
5. 新增 Runtime API：
   - `POST /runtime/runs`
   - `GET /runtime/runs/:runId`
   - `GET /runtime/runs/:runId/events`
   - `GET /runtime/runs/:runId/artifacts`
6. 前端实现最小 Workspace：
   - prompt 输入框
   - Run Timeline
   - Event Stream 面板
   - Artifact 面板
   - Run 状态 badge

### 验收标准

- 用户在 Web 输入 prompt 后能得到 `runId`。
- Web 可以实时看到事件流。
- Runtime 至少能生成一个 `markdown` 或 `risk_list` artifact。
- 所有事件都能在 API 侧查询。
- 这套链路不依赖真实 LLM 或 Temporal。

## Phase 2：Artifact First 与 Renderer Runtime

目标：让 Agent 输出从“消息”升级为“可渲染对象”。

### 重点任务

1. 扩展 Artifact lifecycle：
   - `createdAt`
   - `updatedAt`
   - `version`
   - `status`
   - `storageRef`
   - `createdBy`
   - `metadata`
   - `parentArtifactId`
2. 实现 Artifact Store。
3. 实现 Renderer Registry。
4. 提供第一批 renderer：
   - `markdown-renderer`
   - `json-renderer`
   - `diff-renderer`
   - `risk-list-renderer`
   - `approval-renderer`
   - `workflow-trace-renderer`
5. 前端增加 Artifact Panel，根据 `renderer` 自动选择渲染器。

### 验收标准

- Runtime 生成的 artifact 可以被持久化。
- Web 可以根据 `renderer` 自动选择渲染器。
- 至少支持 `markdown`、`diff`、`risk_list` 三类 artifact。
- Artifact 不再只是 event payload，而是独立资源。

## Phase 3：HITL 闭环

目标：把人工审批做成 Runtime 核心能力，而不是业务页面里的临时逻辑。

### 重点任务

1. 定义 HITL 状态机：
   - `created`
   - `pending`
   - `approved`
   - `rejected`
   - `expired`
   - `cancelled`
2. 实现 `hitl_required` 事件。
3. 实现 Runtime pause / resume。
4. 根据 JSON Schema 渲染审批表单。
5. 审批结果生成 `approval` artifact。
6. 审批动作写入 audit log。

### 验收标准

- `contract-review` 可以触发 `hitl_required`。
- Web 显示审批表单。
- 用户审批后 Runtime 可以 resume。
- 审批结果作为 artifact 存储，并能在 timeline 中回放。

## Phase 4：真实 Agent Adapter 与 Tool Runtime

目标：保持 Framework-agnostic，同时先接入一个真实 Agent Framework。

### 重点任务

1. 定义 `AgentFrameworkAdapter` contract。
2. 实现第一批 adapter：
   - `MockAgentAdapter`
   - `OpenAIAgentsAdapter`
   - 预留 `LangGraphAdapter`
3. 实现 Agent Definition Loader：
   - YAML loader
   - schema validation
   - agent registry
   - tool dependency check
   - renderer dependency check
4. 实现 Tool Registry。
5. Tool Runtime 支持：
   - input validation
   - output schema
   - timeout
   - permission scope
   - tenant scope
   - sandbox policy
   - event emitting
   - audit log
   - artifact output
6. 实现 MCP bridge 初版：
   - MCP server registry
   - MCP tool discovery
   - MCP tool 转 internal `ToolDefinition`
   - tool call event mapping

### 验收标准

- `compare-review` 能通过真实或 mock tool 生成 diff artifact。
- Runtime 可以根据 YAML 加载 agent。
- Tool call 有 `tool_call_started` 与 `tool_call_finished` 事件。
- Adapter 可以替换，不影响 Web 和 Artifact。

## Phase 5：Sandbox Compute Layer

目标：把不可信执行环境和可信 Harness 分开。

### 重点任务

1. 升级 `SandboxProvider`：
   - `createSession`
   - `runCommand`
   - `writeFile`
   - `readFile`
   - `listFiles`
   - `upload`
   - `download`
   - `dispose`
   - `setNetworkPolicy`
   - `setResourceLimits`
2. 开发期优先实现 Docker Sandbox Provider。
3. 云端 demo 可接 E2B。
4. 企业级或强隔离场景再考虑 Firecracker。
5. 定义安全策略：
   - command allow/deny list
   - max runtime
   - max output size
   - filesystem root
   - network egress policy
   - secret injection policy
   - artifact extraction directory

### 验收标准

- Tool 可以选择在 sandbox 中运行。
- Sandbox 产物可以转成 artifact。
- 每次 sandbox 执行都有 audit event。
- 不可信 compute 无法直接访问 Harness secrets。

## Phase 6：Durable Runtime

目标：从 demo runtime 进入长任务 runtime。

### 推荐演进顺序

1. In-memory runtime
2. DB persisted runtime
3. Redis pub/sub 或 stream event bus
4. Temporal workflow runtime

### 重点任务

1. 设计 Runtime Store：
   - `runs`
   - `run_events`
   - `artifacts`
   - `hitl_requests`
   - `tool_calls`
   - `sandbox_sessions`
   - `agent_definitions`
   - `audit_logs`
2. 支持 event replay。
3. 支持 failed run debug。
4. 支持 HITL pending 状态恢复。
5. 接入 Temporal 承载长任务、retry、resume 与 checkpoint。

### 验收标准

- API 重启后 run、event、artifact 不丢。
- HITL pending 状态可以恢复。
- 长任务可以 retry / resume。
- Temporal workflow 可以承载至少一个 agent run。

## Phase 7：Provider 实现与多租户基础

目标：让 Provider Abstraction 从“配置抽象”变成“可替换实现”。

### 重点任务

1. Database Provider：
   - Postgres first
   - SQLite for local quickstart
   - MySQL 保持兼容但不作为主路线
2. Vector Store Provider：
   - pgvector first
   - qdrant 作为可选 profile
3. Object Storage Provider：
   - filesystem for dev
   - MinIO for docker compose
   - S3 for production
4. Auth / Tenant / Workspace：
   - workspace
   - project
   - tenant-level isolation
   - role permission
   - secret scope
   - audit policy

### 验收标准

- 同一个 Runtime API 可以切换 provider。
- tenant A 看不到 tenant B 的 run、artifact、memory。
- secrets 不进入 sandbox event payload。
- provider 状态可检查，敏感信息必须脱敏。

## Phase 8：产品化 Workspace

目标：把 Browser Workspace 做成平台核心入口，而不是普通 Chat UI。

### 建议信息架构

```text
Workspace
  ├── Thread / Run List
  ├── Agent Selector
  ├── Prompt / Task Composer
  ├── Runtime Timeline
  ├── Tool Calls
  ├── HITL Inbox
  ├── Artifact Panel
  ├── Memory Panel
  └── Debug / Trace Panel
```

### 重点任务

1. 引入 assistant-ui，但不要让它反向绑架 Runtime 模型。
2. 实现 Artifact Panel 与 Renderer Registry 的完整联动。
3. 实现 HITL Inbox。
4. 实现 Runtime Inspector。
5. 将 UI Spec 作为 artifact，而不是前端内部临时状态。

### 验收标准

- 用户可以在 Workspace 里启动 run、查看 timeline、处理 HITL、查看 artifact。
- 所有 UI 状态可由 event replay 重建。
- 新增 artifact renderer 不需要改 Runtime。
- 新增 Agent 不需要改 Web。

## Phase 9：评测、审计与 AgentOps

目标：从“能跑”变成“可运营、可调试、可评估”。

### 重点任务

1. `run_trace` artifact。
2. `workflow_trace` artifact。
3. evaluation dataset exporter。
4. replay-based regression test。
5. cost dashboard。
6. audit dashboard。
7. prompt / model / adapter versioning。

### 验收标准

- run trace 可以回放。
- 失败任务可以定位原因。
- tool latency、token usage、cost usage 可观测。
- prompt/model/adapter 改动可以做 regression evaluation。

## 4. 推荐优先级

### P0：立即做

1. 补齐工程基线。
2. 实现 In-memory Runtime。
3. 实现 Runtime API。
4. 实现前端最小 Workspace。

目标：证明这不是聊天框，而是事件驱动 Agent Runtime 平台。

### P1：接着做

1. Artifact Store。
2. Renderer Registry。
3. HITL Runtime。
4. Agent YAML Loader。
5. Tool Registry。
6. `contract-review` 垂直场景。

目标：跑通合同审查、风险列表、diff、人工审批、审计回放。

### P2：再做

1. OpenAI Agents Adapter。
2. MCP Tool Bridge。
3. Docker/E2B Sandbox Provider。
4. DB Persisted Runtime。
5. Object Storage Integration。
6. Auth / Session / Tenant 初版。

目标：从 mock 平台进入可真实执行的 Agent Platform。

### P3：后做

1. Temporal Durable Runtime。
2. Multi-tenant Isolation。
3. Eval / Trace / Observability。
4. Provider Marketplace。
5. Enterprise Auth。
6. Firecracker / Kubernetes Compute。

目标：进入生产级与企业级平台能力。

## 5. 8 周执行计划

### Week 1：工程基线 + Runtime Contract

- 固化 pnpm / turbo / TypeScript 检查。
- 定义强类型 Runtime Events。
- 实现 `InMemoryEventBus`。
- 实现 `InMemoryRunStore`。
- 增加 runtime 单元测试。

交付物：mock run 可发布事件，API 可创建 run。

### Week 2：Web Event Workspace

- 前端增加 prompt 输入。
- 通过 API 创建 run。
- 使用 SSE 订阅事件。
- 显示 timeline。
- 显示 run status。

交付物：浏览器里能看到完整 run lifecycle。

### Week 3：Artifact MVP

- 实现 artifact store。
- 支持 markdown / risk_list / diff artifact。
- API 查询 artifact。
- 前端 artifact panel。
- `artifact_created` 驱动 UI 更新。

交付物：mock agent 可以生成 artifact，Web 可渲染 artifact。

### Week 4：Agent Definition Loader + contract-review mock

- 加载 `agents/*.yaml`。
- 校验 agent config。
- 根据 `agentCode` 找到 agent。
- `contract-review` mock 输出风险列表。
- `compare-review` mock 输出 diff。

交付物：YAML 不再只是配置文件，而是 Runtime 输入。

### Week 5：HITL 闭环

- 读取 `hitl.schema.json`。
- 发布 `hitl_required`。
- Web 渲染审批表单。
- 用户 approve / reject。
- Runtime resume 或 stop。
- 生成 approval artifact。

交付物：`contract-review` 可以暂停等待人工审批。

### Week 6：Tool Runtime

- 实现 tool registry。
- `compare_review_diff` 作为第一个真实或半真实 tool。
- tool call events。
- tool execution result artifact。
- tool timeout / error handling。

交付物：timeline 里能看到 tool started / finished，tool 结果进入 artifact。

### Week 7：Sandbox 初版

- 实现 Docker sandbox provider 或本地受限 provider。
- tool 可声明是否需要 sandbox。
- sandbox stdout / stderr 转 artifact 或 event。
- 增加资源限制和超时。

交付物：不可信命令不在 Harness 直接执行。

### Week 8：持久化 Runtime 初版

- Postgres 表设计。
- runs / events / artifacts / hitl_requests 持久化。
- API 重启后可恢复查询。
- event replay。
- 为后续 Temporal 做准备。

交付物：从 demo runtime 进入 durable runtime 的第一步。

## 6. 最小产品切片

推荐先做 **Contract Review Agent Workspace**。

这个切片天然覆盖平台核心能力：

| 平台能力 | Contract Review 中的体现 |
| --- | --- |
| Runtime Event | 审查过程 timeline |
| Artifact | 风险列表、diff、审批结果 |
| HITL | 是否应用修订 |
| Tool Runtime | diff / compare tool |
| Sandbox | 文档处理、脚本执行 |
| Memory | 历史条款、审查偏好 |
| Renderer | risk_list、diff、approval |
| Provider | DB、object storage、vector store |

最小用户故事：

> 用户上传或输入合同文本，Agent 生成风险列表和修改 diff，系统要求人工审批，用户审批后生成最终修改建议和审计记录。

## 7. 关键技术决策

1. 第一阶段不要直接上 Temporal，先让 Runtime 语义稳定。
2. 第一阶段不要绑定真实 LLM，先用 `MockAgentAdapter` 打通事件、artifact、HITL 与 UI。
3. Artifact 要尽早持久化，不要长期停留在 event payload。
4. Tool 不能只是函数调用，必须具备权限、审计、沙箱、schema、timeout 与 artifact 输出能力。
5. Web UI 的核心不是聊天，而是 Runtime Inspector。
6. Provider 抽象必须在业务代码边界强制执行，避免具体实现泄漏到 Runtime 业务逻辑。

## 8. 里程碑版本

### v0.1：Runtime Skeleton 可运行

- In-memory runtime
- event stream
- mock agent
- basic workspace
- markdown artifact

### v0.2：Artifact + HITL

- artifact store
- renderer registry
- approval flow
- contract-review mock

### v0.3：Tool + Agent Definition

- YAML agent loader
- tool registry
- compare-review diff tool
- tool events

### v0.4：Sandbox + Provider

- sandbox provider
- object storage provider
- DB persisted runtime
- provider health page

### v0.5：真实 Agent Adapter

- OpenAI Agents adapter
- LLM streaming to runtime events
- MCP bridge initial version

### v0.6：Durable Runtime

- Temporal integration
- resume / retry / checkpoint
- event replay
- failed run debug

### v0.7：Multi-tenant Platform

- auth provider implementation
- tenant / workspace / project
- RBAC
- secret isolation
- audit dashboard

## 9. 北极星检查指标

1. 一个 run 的完整过程是否都能事件化？
2. 任何 UI 状态是否能由 event replay 重建？
3. Agent 输出是否主要是 artifact，而不是 markdown？
4. 新增 Agent Framework 是否只需要新增 adapter？
5. 新增 Tool 是否自动进入 registry、权限、审计、sandbox？
6. HITL 是否是 Runtime 能力，而不是业务页面逻辑？
7. Compute 是否永远不被视为不可信？
8. 业务代码是否避免直接依赖具体 DB、vector store、object storage、LLM、sandbox 实现？
