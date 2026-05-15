import { runtimeEventTypes } from "@agent-platform/protocol";
import { WorkspaceClient } from "./workspace-client";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Browser-based Agent Operating Platform</p>
        <h1>Agent Workspace 事件驱动闭环</h1>
        <p>
          当前版本聚焦项目 Phase 1：Web 输入 prompt，API 创建 run，Runtime
          发布事件，前端展示 timeline，并生成可查询 artifact。
        </p>
      </section>

      <WorkspaceClient />

      <section className="panel protocol-panel">
        <h2>Runtime Event Protocol</h2>
        <ul className="protocol-list">
          {runtimeEventTypes.map((eventType) => (
            <li key={eventType}>{eventType}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
