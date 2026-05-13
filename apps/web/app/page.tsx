import { runtimeEventTypes } from "@agent-platform/protocol";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Browser-based Agent Operating Platform</p>
        <h1>Agent Workspace 基础骨架</h1>
        <p>
          前端 Workspace 将承载 assistant-ui、Artifact Renderer、HITL Runtime 与事件流订阅。
        </p>
      </section>

      <section className="panel">
        <h2>Runtime Event Protocol</h2>
        <ul>
          {runtimeEventTypes.map((eventType) => (
            <li key={eventType}>{eventType}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
