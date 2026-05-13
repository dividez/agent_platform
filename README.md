# Browser-based Agent Operating Platform 架构方案（最终版）

## 一、项目定位

目标不是：

- ChatBot
- Dify Clone
- Workflow Builder
- Prompt Playground

而是：

## Browser-based Agent Operating Platform

即：

Runtime + Protocol + Artifact + UI Runtime + HITL + Sandbox + Tool Runtime

平台核心是：

- Browser Workspace
- Agent Runtime
- Runtime Event System
- Artifact System
- HITL Runtime
- Protocol Layer
- Sandbox Compute Layer

而不是：

- 单纯聊天
- Workflow 编排页面
- Prompt 工具

---

## 二、核心设计原则

### 1. Framework-agnostic

平台不能绑定：

- OpenAI Agents SDK
- Cursor SDK
- Claude SDK
- Google ADK
- LangGraph
- CrewAI
- AutoGen

必须 Adapter 化，例如：

```text
OpenAIAgentsAdapter
ClaudeAdapter
CursorAdapter
LangGraphAdapter
GoogleADKAdapter
```

Agent Framework 可替换。

---

### 2. Runtime First

真正长期值钱的是：

- Runtime
- Protocol
- Artifact
- HITL
- UI Runtime
- Sandbox

而不是：

- 某个 Agent SDK
- 某个 Workflow Builder

---

### 3. Harness / Compute 分离

必须区分：

#### Harness Layer（可信层）

负责：

- memory
- workflow
- orchestration
- tool scheduling
- checkpoint
- audit
- auth
- tenant isolation
- secrets
- external api
- event emitting

#### Compute Layer（执行层）

负责：

- shell
- code execution
- browser automation
- filesystem
- sandbox
- script runtime

Compute 必须视为不可信执行环境。

---

### 4. Event-driven

不是：

```text
request -> response
```

而是：

```text
Runtime Event Protocol
```

所有执行过程事件化。

---

### 5. Artifact First

Agent 不应该只输出 markdown。

应该输出 Artifact，例如：

- markdown
- table
- diff
- workflow_trace
- approval
- risk_list
- html
- document_linked
- ui_spec

---

### 6. UI Spec First

未来不是：

```text
LLM -> Markdown
```

而是：

```text
LLM -> UI Spec -> Renderer -> Interactive Workspace
```

---

### 7. Provider Abstraction First

所有基础设施必须 Provider 化：

- Database
- Vector Store
- Object Storage
- LLM
- Sandbox
- Queue
- Auth

业务代码不能依赖具体实现。

---

## 三、最终技术栈

### Monorepo

```text
Turborepo + pnpm workspace
```

原因：未来 runtime、protocol、artifact、sandbox、ui-runtime、renderer、mcp 一定会拆 package。

---

### Frontend

```text
Next.js 15+
React 19
TypeScript
```

原因：

- RSC
- Streaming
- AI SDK 生态
- assistant-ui 最适配
- Server Actions
- Edge Runtime

---

### UI

```text
Tailwind CSS
shadcn/ui
Radix UI
Motion
```

---

### AI UI Runtime

```text
assistant-ui
```

负责：

- conversation
- thread
- streaming
- tool ui
- approval ui
- runtime ui

不是聊天框。

---

### Structured UI

```text
json-render
```

负责：

- UI Spec
- Artifact Renderer
- Structured Result Renderer
- HITL Renderer

---

### AI SDK

```text
Vercel AI SDK
```

原因：Provider abstraction 极其重要。

未来一定会混用：

```text
GPT
Claude
Gemini
DeepSeek
Qwen
```

---

### Agent Runtime

```text
OpenAI Agents SDK
```

原因：Harness / Compute 分离做得最好。

但必须 Adapter 化。

---

### Backend Runtime

```text
Hono
```

原因：TypeScript Fullstack 最优。

---

### Queue / Workflow Runtime

```text
Temporal
```

不是：

```text
BullMQ
```

原因：未来一定会需要：

- durable execution
- resume
- retry
- checkpoint
- long-running agent
- orchestration
- HITL pause/resume

---

### Sandbox Layer

第一阶段：

```text
E2B
```

第二阶段：

```text
Docker Sandbox
```

长期：

```text
Firecracker
```

---

### Storage

#### 主数据库

```text
PostgreSQL
```

#### ORM

```text
Drizzle ORM
```

#### Runtime State

```text
Redis
```

---

### Auth

```text
Better Auth
```

支持：

- RBAC
- workspace
- tenant
- enterprise auth

---

## 四、协议层（核心）

### MCP

负责：

```text
Tool Protocol
```

所有 Tool MCP 化。

---

### A2A

负责：

```text
Agent ↔ Agent
```

例如：

```text
PlannerAgent
  ↓
ReviewAgent
  ↓
DiffAgent
```

---

### AG-UI-like

负责：

```text
Agent ↔ UI
```

---

### Runtime Event Protocol

平台核心协议，例如：

```text
run_started
message_delta
tool_call_started
tool_call_finished
artifact_created
hitl_required
run_finished
run_failed
```

---

## 五、Runtime 架构（核心）

```text
┌──────────────────────────────────┐
│           Web Workspace          │
│                                  │
│ assistant-ui                     │
│ json-render                      │
│ Result Renderer                  │
│ HITL Runtime                     │
│ Workflow Timeline                │
└──────────────▲───────────────────┘
               │
        AG-UI-like Events
               │
┌──────────────┴───────────────────┐
│         Agent Runtime Layer      │
│                                  │
│ Run Engine                       │
│ Event Bus                        │
│ Artifact Manager                 │
│ HITL Session Manager             │
│ Memory Abstraction               │
│ Tool Registry                    │
│ Sandbox Adapter                  │
└──────────────▲───────────────────┘
               │
┌──────────────┴───────────────────┐
│         Agent Framework Layer    │
│                                  │
│ OpenAI Agents SDK                │
│ Cursor SDK                       │
│ Claude SDK                       │
│ Google ADK                       │
│ LangGraph                        │
└──────────────▲───────────────────┘
               │
┌──────────────┴───────────────────┐
│           Protocol Layer         │
│                                  │
│ MCP                              │
│ A2A                              │
│ AG-UI                            │
│ Runtime Event Protocol           │
└──────────────▲───────────────────┘
               │
┌──────────────┴───────────────────┐
│          Compute Layer           │
│                                  │
│ Docker Sandbox                   │
│ E2B                              │
│ Kubernetes Jobs                  │
└──────────────────────────────────┘
```

---

## 六、同步触发，异步执行

平台执行模型：

```text
Sync Trigger + Async Runtime
```

不是同步阻塞执行。

### 标准流程

```text
Browser
  ↓
POST /api/runs
  ↓
Create Run
  ↓
Return run_id
  ↓
Temporal Workflow
  ↓
Agent Runtime Execute
  ↓
Emit Runtime Events
  ↓
Event Store + Redis Stream
  ↓
SSE / WebSocket
  ↓
Browser Workspace
```

### API 示例

#### 创建任务

```http
POST /api/runs
```

返回：

```json
{
  "run_id": "run_xxx",
  "status": "queued",
  "stream_url": "/api/runs/run_xxx/events"
}
```

#### 订阅事件

```http
GET /api/runs/{run_id}/events
```

### 事件示例

```json
{
  "event": "run_started"
}
```

```json
{
  "event": "tool_call_started",
  "tool": "compare_review_diff"
}
```

```json
{
  "event": "artifact_created",
  "artifact_type": "diff"
}
```

```json
{
  "event": "hitl_required"
}
```

```json
{
  "event": "run_finished"
}
```

---

## 七、Artifact System（核心）

### Artifact First

Artifact 类型：

```text
markdown
table
diff
workflow_trace
risk_list
approval
document_linked
html
ui_spec
```

### Artifact Schema

```json
{
  "artifact_type": "contract_review",
  "renderer": "json_render",
  "spec": {}
}
```

---

## 八、Result Renderer（核心）

不能只 markdown。

必须使用 Renderer Registry，例如：

```text
MarkdownRenderer
RiskListRenderer
DiffRenderer
ApprovalRenderer
ArtifactRenderer
JsonRenderRenderer
WorkflowTimelineRenderer
```

---

## 九、HITL Runtime（核心）

不能：

```text
每个 Agent 写一个页面
```

必须 Schema-driven HITL。

### 示例

```json
{
  "type": "approval",
  "title": "是否应用修订"
}
```

前端通过 `ApprovalRenderer` 自动渲染。

---

## 十、json-render（核心）

未来：

```text
Agent
  ↓
UI Spec
  ↓
Renderer
  ↓
Workspace
```

### Catalog

```text
MarkdownBlock
RiskList
RiskCard
DiffViewer
WorkflowTimeline
ApprovalDialog
ArtifactFrame
ClauseLocator
```

### 核心原则

Agent 不能生成任意 HTML，只能组合 Catalog 中的组件。

---

## 十一、Agent Definition（核心）

Agent 不应该是代码，应该是 `agent.yaml`。

### 示例

```yaml
code: contract-review

runtime: openai-agents

model: gpt-4.1

tools:
  - compare_review_diff

hitl:
  schema: hitl.schema.json

result:
  renderer: json-render
```

---

## 十二、Memory（核心）

Memory 必须可插拔，不要绑定具体向量库。

### Memory 抽象

```text
ConversationMemory
SemanticMemory
ArtifactMemory
WorkflowMemory
```

---

## 十三、LLM Provider 可插拔设计

LLM 不能绑定单一厂商，必须 Provider 化。

### 目标支持

```text
OpenAI
Azure OpenAI
Claude
Gemini
DeepSeek
Qwen
OpenAI Compatible API
私有化模型
```

### 抽象接口

```ts
interface ModelProvider {
  provider: string;

  chat(input: ChatInput): Promise<ChatResult>;

  stream(input: ChatInput): AsyncIterable<ModelStreamEvent>;

  embeddings(input: EmbeddingInput): Promise<EmbeddingResult>;

  capabilities(): ModelCapabilities;
}
```

### 能力声明

```ts
type ModelCapabilities = {
  streaming: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  vision: boolean;
  jsonMode: boolean;
  embeddings: boolean;
  reasoning: boolean;
};
```

---

## 十四、基础设施可插拔设计

### Database Provider

目标支持：

- PostgreSQL
- MySQL
- Oracle
- OceanBase

#### Database 抽象

```ts
interface DatabaseProvider {
  dialect: string;

  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}
```

#### 原则

业务代码禁止：

- 直接依赖 jsonb
- 直接依赖 array
- 直接依赖 enum
- 直接依赖 PostgreSQL 特性

---

### Vector Store Provider

目标支持：

- pgvector
- Qdrant
- Milvus
- OpenSearch Vector

#### 抽象

```ts
interface VectorStoreProvider {
  ensureCollection(): Promise<void>;

  upsert(): Promise<void>;

  search(): Promise<VectorSearchResult[]>;
}
```

---

### Object Storage Provider

目标支持：

- S3
- OSS
- COS
- OBS
- MinIO

#### 抽象

```ts
interface ObjectStorageProvider {
  putObject(): Promise<StoredObject>;

  getObject(): Promise<ReadableStream>;

  deleteObject(): Promise<void>;

  createPresignedUrl(): Promise<string>;
}
```

---

### Provider Capability

```ts
type ProviderCapabilities = {
  transactions?: boolean;
  vectorFilter?: boolean;
  hybridSearch?: boolean;
  multipartUpload?: boolean;
};
```

---

## 十五、目录结构（最终版）

```text
apps/
  web/

packages/
  runtime/
  protocol/
  artifact/
  renderer/
  ui-runtime/
  hitl-runtime/
  memory/
  tools/
  sandbox/
  auth/
  db/
  mcp/

agents/
  contract-review/
  compare-review/
```

---

## 十六、真正长期值钱的部分

真正长期值钱的：

```text
Runtime
Protocol
Artifact
UI Runtime
HITL
Sandbox
Provider Abstraction
```

不是：

```text
Workflow Builder
Prompt Editor
Chat UI
```

---

## 十七、最终一句话（最终结论）

## Browser-based Agent Operating Platform

平台核心不是绑定某个：

- Agent Framework
- Model SDK
- Database
- Vector Store
- Sandbox

而是建立：

## Runtime + Protocol + Artifact + UI Runtime + Provider Abstraction + Async Execution

其中：

- Agent Framework 可替换
- LLM Provider 可替换
- Database 可替换
- Vector Store 可替换
- Object Storage 可替换
- Sandbox 可替换
- UI Renderer 可扩展

平台执行模型：

## 同步触发，异步执行，事件驱动，前端订阅

即：

```text
Browser 创建 Run
  ↓
Runtime 异步执行
  ↓
Runtime Event Protocol 推送
  ↓
Artifact 持久化
  ↓
UI Runtime 动态渲染
```

最终目标不是：

```text
AI Chat
```

而是：

## Agent Operating System for Browser Workspace

---

## 十一、基础设施 Provider 化扩展

本仓库现在把关键基础设施配置抽象为可切换 Provider，业务层只依赖统一接口，不直接绑定具体实现。

### 1. 数据库多版本切换

数据库通过 `DATABASE_PROVIDER` 与 `DATABASE_URL` 切换，当前类型层支持：

- `postgres`
- `mysql`
- `sqlite`

默认使用 PostgreSQL：

```bash
DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://agent:agent@localhost:5432/agent_platform
DATABASE_MIGRATIONS_DIR=migrations/sql/postgres
```

切换到 MySQL：

```bash
DATABASE_PROVIDER=mysql
DATABASE_URL=mysql://agent:agent@localhost:3306/agent_platform
DATABASE_MIGRATIONS_DIR=migrations/sql/mysql
docker compose --profile mysql up
```

数据库运行时配置与迁移配置由 `@agent-platform/db` 暴露，API 的 `/infra/providers` 会返回当前激活配置。

### 2. 数据库版本迁移

迁移文件按数据库方言隔离：

```text
migrations/sql/postgres/*.sql
migrations/sql/mysql/*.sql
```

可用以下命令检查迁移文件与 SHA-256 校验值：

```bash
pnpm migrations:check
DATABASE_PROVIDER=mysql pnpm migrations:check
```

`DATABASE_MIGRATIONS_RUN_ON_STARTUP` 默认关闭，避免服务启动时自动改库；生产环境建议由 CI/CD 或专门的 migration job 执行。

### 3. 二级子路径入口

Web 与 API 都支持部署到二级子路径：

```bash
PUBLIC_BASE_PATH=/agent-platform
# 或分别配置
NEXT_PUBLIC_WEB_BASE_PATH=/agent-platform
API_BASE_PATH=/agent-platform
```

Next.js 会设置 `basePath` / `assetPrefix`，API 会同时挂载根路径与配置后的子路径，便于灰度迁移。

### 4. 多版本向量库

向量库通过 `VECTOR_STORE_PROVIDER` 切换，当前类型层支持：

- `pgvector`
- `qdrant`
- `milvus`
- `chroma`
- `pinecone`
- `weaviate`

本地 Qdrant 可通过 profile 启动：

```bash
docker compose --profile vector up qdrant
```

### 5. 多版本对象存储

对象存储通过 `OBJECT_STORAGE_PROVIDER` 切换，当前类型层支持：

- `minio`
- `s3`
- `gcs`
- `azure-blob`
- `filesystem`

本地 MinIO 可通过 profile 启动：

```bash
docker compose --profile object-storage up minio
```
