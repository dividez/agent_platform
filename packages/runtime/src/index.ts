import type { RuntimeEvent } from "@agent-platform/protocol";

export interface RuntimeEventBus {
  publish(event: RuntimeEvent): Promise<void>;
  subscribe(runId: string): AsyncIterable<RuntimeEvent>;
}

export interface AgentRuntime {
  startRun(input: { agentCode: string; prompt: string }): Promise<{ runId: string }>;
}
