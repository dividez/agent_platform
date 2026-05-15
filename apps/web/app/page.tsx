import { WorkspaceClient } from "./workspace-client";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero launch-hero">
        <div className="hero-copy">
          <p className="eyebrow">Prompt Collector Workspace</p>
          <h1>把用户意图像聊天一样收集、执行、沉淀成结果。</h1>
          <p>
            用一个轻量启动页完成从 Prompt 输入、Agent Run
            实时渲染、人工确认到最终产物展示的闭环。
            更少配置感，更像一次清晰的协作对话。
          </p>
        </div>
        <div className="hero-card" aria-label="Prompt workflow summary">
          <span>01 收集意图</span>
          <span>02 持续渲染</span>
          <span>03 人工确认</span>
          <span>04 展示结果</span>
        </div>
      </section>

      <WorkspaceClient />
    </main>
  );
}
