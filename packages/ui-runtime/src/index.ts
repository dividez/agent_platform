import type { RuntimeEvent } from "@agent-platform/protocol";

export interface UiRuntimeEventSource {
  connect(runId: string): AsyncIterable<RuntimeEvent>;
}
