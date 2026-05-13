# Docker 骨架

该目录保存本地开发与未来部署相关的容器资源：

- `web/Dockerfile`：Next.js Workspace 前端开发镜像。
- `api/Dockerfile`：Hono Runtime API 开发镜像。
- `postgres/init.sql`：PostgreSQL 初始化脚本。

根目录 `docker-compose.yaml` 编排 Web、API、PostgreSQL、Redis 与 Temporal 基础服务。
