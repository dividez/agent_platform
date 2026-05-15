export const runtimeEventTypes = [
  "run_started",
  "message_delta",
  "tool_call_started",
  "tool_call_finished",
  "artifact_created",
  "hitl_required",
  "run_finished",
  "run_failed",
] as const;

export type RuntimeEventType = (typeof runtimeEventTypes)[number];

export type RunStatus =
  | "queued"
  | "running"
  | "waiting_for_hitl"
  | "finished"
  | "failed"
  | "cancelled";

export interface RuntimeEventBase<TType extends RuntimeEventType, TPayload> {
  id: string;
  runId: string;
  type: TType;
  payload: TPayload;
  createdAt: string;
}

export interface RunStartedPayload {
  agentCode: string;
  prompt: string;
}

export type RunStartedEvent = RuntimeEventBase<
  "run_started",
  RunStartedPayload
>;

export interface MessageDeltaPayload {
  role: "assistant" | "tool" | "system";
  content: string;
  sequence: number;
}

export type MessageDeltaEvent = RuntimeEventBase<
  "message_delta",
  MessageDeltaPayload
>;

export interface ToolCallStartedPayload {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export type ToolCallStartedEvent = RuntimeEventBase<
  "tool_call_started",
  ToolCallStartedPayload
>;

export interface ToolCallFinishedPayload {
  toolCallId: string;
  toolName: string;
  output: unknown;
  durationMs: number;
}

export type ToolCallFinishedEvent = RuntimeEventBase<
  "tool_call_finished",
  ToolCallFinishedPayload
>;

export interface ArtifactCreatedPayload {
  artifactId: string;
  type: string;
  renderer: string;
  title: string;
}

export type ArtifactCreatedEvent = RuntimeEventBase<
  "artifact_created",
  ArtifactCreatedPayload
>;

export interface HitlRequiredPayload {
  requestId: string;
  title: string;
  schema: unknown;
}

export type HitlRequiredEvent = RuntimeEventBase<
  "hitl_required",
  HitlRequiredPayload
>;

export interface RunFinishedPayload {
  status: "finished";
  message: string;
}

export type RunFinishedEvent = RuntimeEventBase<
  "run_finished",
  RunFinishedPayload
>;

export interface RunFailedPayload {
  status: "failed";
  error: string;
}

export type RunFailedEvent = RuntimeEventBase<"run_failed", RunFailedPayload>;

export type RuntimeEvent =
  | RunStartedEvent
  | MessageDeltaEvent
  | ToolCallStartedEvent
  | ToolCallFinishedEvent
  | ArtifactCreatedEvent
  | HitlRequiredEvent
  | RunFinishedEvent
  | RunFailedEvent;

export type RuntimeEventPayload<TType extends RuntimeEventType> = Extract<
  RuntimeEvent,
  { type: TType }
>["payload"];
