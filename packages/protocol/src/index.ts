export const runtimeEventTypes = [
  "run_started",
  "message_delta",
  "tool_call_started",
  "tool_call_finished",
  "artifact_created",
  "hitl_required",
  "run_finished",
  "run_failed"
] as const;

export type RuntimeEventType = (typeof runtimeEventTypes)[number];

export type RuntimeEvent<TPayload = unknown> = {
  id: string;
  runId: string;
  type: RuntimeEventType;
  payload: TPayload;
  createdAt: string;
};
