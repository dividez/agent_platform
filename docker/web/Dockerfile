FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/protocol/package.json packages/protocol/package.json
RUN pnpm install --filter @agent-platform/web... --frozen-lockfile=false

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@agent-platform/web", "dev"]
