# 项目骨架说明

## 目录划分

```text
apps/
  web/                  # Next.js 前端 Workspace
  api/                  # Hono 后端 Runtime API
packages/
  runtime/              # Agent Runtime 抽象
  protocol/             # Runtime Event Protocol
  artifact/             # Artifact 类型与契约
  renderer/             # Renderer Registry 契约
  ui-runtime/           # UI Runtime 事件源契约
  hitl-runtime/         # HITL 请求与审批契约
  memory/               # Memory Provider 抽象
  tools/                # Tool Definition 抽象
  sandbox/              # Sandbox Provider 抽象
  auth/                 # Auth Provider 抽象
  db/                   # Database Provider 抽象
  mcp/                  # MCP Server 定义
agents/                 # Agent Definition 配置
docker/                 # Dockerfile 与基础设施初始化脚本
infra/                  # 基础设施配置
```

## 本地启动

```bash
cp .env.example .env
pnpm install
docker compose up --build
```

也可以只启动应用：

```bash
pnpm dev
```
