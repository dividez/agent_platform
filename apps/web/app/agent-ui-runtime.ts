import {
  EventType,
  type AGUIEvent,
  type CustomEvent,
  type RunFinishedEvent as AgUiRunFinishedEvent,
  type RunStartedEvent as AgUiRunStartedEvent,
  type TextMessageContentEvent,
  type TextMessageEndEvent,
  type TextMessageStartEvent,
  type ToolCallArgsEvent,
  type ToolCallEndEvent,
  type ToolCallStartEvent,
} from "@ag-ui/core";
import type { AssistantRuntime } from "@assistant-ui/react";
import type { UseChatRuntimeOptions } from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "@ai-sdk/react";
import type { RuntimeEvent } from "@agent-platform/protocol";

export const agentUiStack = [
  {
    id: "assistant-ui",
    label: "assistant-ui",
    role: "Thread, tool UI, HITL and generative UI shell",
  },
  {
    id: "vercel-ai-sdk",
    label: "Vercel AI SDK",
    role: "Streaming chat runtime boundary",
  },
  {
    id: "ag-ui",
    label: "AG-UI",
    role: "Agent event protocol compatibility",
  },
  {
    id: "renderer-registry",
    label: "Renderer Registry",
    role: "JSON events to React artifacts",
  },
] as const;

export interface AgentUiRuntimeAdapters {
  assistantRuntime?: AssistantRuntime;
  aiSdkRuntime?: UseChatRuntimeOptions;
  initialMessages?: UIMessage[];
}

export interface UiRenderEnvelope<TProps = unknown> {
  event: "ui_render";
  renderer: string;
  props: TProps;
}

export function runtimeEventToAgUiEvents(event: RuntimeEvent): AGUIEvent[] {
  const timestamp = new Date(event.createdAt).getTime();

  switch (event.type) {
    case "run_started":
      return [
        {
          type: EventType.RUN_STARTED,
          threadId: event.runId,
          runId: event.runId,
          timestamp,
          rawEvent: event,
        } satisfies AgUiRunStartedEvent,
        {
          type: EventType.TEXT_MESSAGE_START,
          messageId: `${event.runId}:assistant`,
          role: "assistant",
          timestamp,
          rawEvent: event,
        } satisfies TextMessageStartEvent,
      ];
    case "message_delta":
      return [
        {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: `${event.runId}:assistant`,
          delta: event.payload.content,
          timestamp,
          rawEvent: event,
        } satisfies TextMessageContentEvent,
      ];
    case "tool_call_started":
      return [
        {
          type: EventType.TOOL_CALL_START,
          toolCallId: event.payload.toolCallId,
          toolCallName: event.payload.toolName,
          parentMessageId: `${event.runId}:assistant`,
          timestamp,
          rawEvent: event,
        } satisfies ToolCallStartEvent,
        {
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: event.payload.toolCallId,
          delta: JSON.stringify(event.payload.input),
          timestamp,
          rawEvent: event,
        } satisfies ToolCallArgsEvent,
      ];
    case "tool_call_finished":
      return [
        {
          type: EventType.TOOL_CALL_END,
          toolCallId: event.payload.toolCallId,
          timestamp,
          rawEvent: event,
        } satisfies ToolCallEndEvent,
      ];
    case "artifact_created":
      return [
        {
          type: EventType.CUSTOM,
          name: "ui_render",
          value: runtimeEventToUiRender(event),
          timestamp,
          rawEvent: event,
        } satisfies CustomEvent,
      ];
    case "hitl_required":
      return [
        {
          type: EventType.CUSTOM,
          name: "hitl_required",
          value: runtimeEventToUiRender(event),
          timestamp,
          rawEvent: event,
        } satisfies CustomEvent,
      ];
    case "run_finished":
      return [
        {
          type: EventType.TEXT_MESSAGE_END,
          messageId: `${event.runId}:assistant`,
          timestamp,
          rawEvent: event,
        } satisfies TextMessageEndEvent,
        {
          type: EventType.RUN_FINISHED,
          threadId: event.runId,
          runId: event.runId,
          timestamp,
          rawEvent: event,
        } satisfies AgUiRunFinishedEvent,
      ];
    case "run_failed":
      return [
        {
          type: EventType.CUSTOM,
          name: "run_failed",
          value: event.payload,
          timestamp,
          rawEvent: event,
        } satisfies CustomEvent,
      ];
  }
}

export function runtimeEventToUiRender(
  event: RuntimeEvent,
): UiRenderEnvelope | undefined {
  switch (event.type) {
    case "artifact_created":
      return {
        event: "ui_render",
        renderer: event.payload.renderer,
        props: {
          artifactId: event.payload.artifactId,
          type: event.payload.type,
          title: event.payload.title,
        },
      };
    case "hitl_required":
      return {
        event: "ui_render",
        renderer: "hitl_form",
        props: {
          requestId: event.payload.requestId,
          title: event.payload.title,
          schema: event.payload.schema,
        },
      };
    default:
      return undefined;
  }
}

export function countAgUiEvents(events: RuntimeEvent[]): number {
  return events.reduce(
    (total, event) => total + runtimeEventToAgUiEvents(event).length,
    0,
  );
}
