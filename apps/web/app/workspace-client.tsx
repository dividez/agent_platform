"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Artifact } from "@agent-platform/artifact";
import {
  createDefaultRendererRegistry,
  type RenderedArtifact,
} from "@agent-platform/renderer";
import {
  runtimeEventTypes,
  type RuntimeEvent,
  type RunStatus,
} from "@agent-platform/protocol";
import {
  agentUiStack,
  countAgUiEvents,
  runtimeEventToUiRender,
} from "./agent-ui-runtime";

interface RunRecord {
  id: string;
  agentCode: string;
  prompt: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

interface RunSnapshot {
  run?: RunRecord;
  events: RuntimeEvent[];
  artifacts: Artifact[];
  hitlRequests: HitlRequest[];
}

interface HitlRequest {
  id: string;
  runId: string;
  title: string;
  schema: JsonSchemaLike;
  status:
    | "created"
    | "pending"
    | "approved"
    | "rejected"
    | "expired"
    | "cancelled";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  response?: unknown;
}

interface JsonSchemaLike {
  title?: string;
  properties?: Record<string, { title?: string; type?: string }>;
  required?: string[];
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/g, "") ??
  "http://localhost:8787";
const rendererRegistry = createDefaultRendererRegistry();

export function WorkspaceClient() {
  const [agentCode, setAgentCode] = useState("contract-review");
  const [prompt, setPrompt] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | undefined>();
  const [snapshot, setSnapshot] = useState<RunSnapshot>({
    events: [],
    artifacts: [],
    hitlRequests: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRespondingToHitl, setIsRespondingToHitl] = useState(false);
  const [hitlComment, setHitlComment] = useState("");
  const [error, setError] = useState<string | undefined>();
  const launchPromptRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = !isSubmitting;
  const isTerminal =
    snapshot.run?.status === "finished" ||
    snapshot.run?.status === "failed" ||
    snapshot.run?.status === "cancelled";
  const pendingHitlRequest = snapshot.hitlRequests.find(
    (request) => request.status === "pending",
  );

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    const runId = activeRunId;
    let cancelled = false;
    let eventSource: EventSource | undefined;
    let fallbackTimeout: ReturnType<typeof setTimeout> | undefined;

    async function refreshSnapshot(): Promise<RunSnapshot | undefined> {
      try {
        const next = await fetchRunSnapshot(runId);

        if (cancelled) {
          return undefined;
        }

        setSnapshot(next);
        setError(undefined);
        return next;
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "无法刷新 run 状态。",
          );
        }
        return undefined;
      }
    }

    function scheduleFallbackRefresh(delayMs = 1200) {
      fallbackTimeout = setTimeout(async () => {
        const next = await refreshSnapshot();

        if (!cancelled && !isTerminalSnapshot(next)) {
          scheduleFallbackRefresh();
        }
      }, delayMs);
    }

    function handleRuntimeEvent(message: MessageEvent<string>) {
      try {
        const event = JSON.parse(message.data) as RuntimeEvent;

        setSnapshot((current) => ({
          ...current,
          run: updateRunFromEvent(current.run, event),
          events: appendRuntimeEvent(current.events, event),
        }));
        setError(undefined);

        if (
          event.type === "artifact_created" ||
          event.type === "hitl_required"
        ) {
          void refreshSnapshot();
        }

        if (event.type === "run_finished" || event.type === "run_failed") {
          eventSource?.close();
          void refreshSnapshot();
        }
      } catch {
        if (!cancelled) {
          setError("事件流数据解析失败，正在尝试刷新 run 快照。");
          void refreshSnapshot();
        }
      }
    }

    void refreshSnapshot();

    eventSource = new EventSource(
      `${apiBaseUrl}/runtime/runs/${runId}/events/stream`,
    );

    for (const eventType of runtimeEventTypes) {
      eventSource.addEventListener(eventType, handleRuntimeEvent);
    }

    eventSource.onerror = () => {
      eventSource?.close();

      if (!cancelled) {
        setError("事件流连接中断，已切换为快照刷新。");
        scheduleFallbackRefresh(250);
      }
    };

    return () => {
      cancelled = true;
      eventSource?.close();

      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
    };
  }, [activeRunId]);

  const eventCounts = useMemo(() => {
    return snapshot.events.reduce<Record<string, number>>((counts, event) => {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
      return counts;
    }, {});
  }, [snapshot.events]);
  const latestArtifact = snapshot.artifacts[snapshot.artifacts.length - 1];
  const runPhase = getRunPhase(snapshot.run?.status, pendingHitlRequest);
  const hasStarted = Boolean(activeRunId);
  const agUiEventCount = useMemo(
    () => countAgUiEvents(snapshot.events),
    [snapshot.events],
  );

  function updatePrompt(value: string) {
    setPrompt(value);
  }

  async function startRun() {
    const submittedPrompt = (
      prompt ||
      launchPromptRef.current?.value ||
      ""
    ).trim();

    if (!submittedPrompt || !canSubmit) {
      setError("先输入你想让 Agent 完成的任务。");
      return;
    }

    setIsSubmitting(true);
    setError(undefined);
    setSnapshot({ events: [], artifacts: [], hitlRequests: [] });
    setHitlComment("");
    setPrompt(submittedPrompt);

    try {
      const response = await fetch(`${apiBaseUrl}/runtime/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentCode,
          prompt: submittedPrompt,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `创建 run 失败：${response.status}`);
      }

      const body = (await response.json()) as {
        runId: string;
        run?: RunRecord;
      };
      setActiveRunId(body.runId);
      setSnapshot({
        run: body.run,
        events: [],
        artifacts: [],
        hitlRequests: [],
      });
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "创建 run 失败。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function respondToHitl(approved: boolean) {
    if (!activeRunId || !pendingHitlRequest || isRespondingToHitl) {
      return;
    }

    setIsRespondingToHitl(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/runtime/runs/${activeRunId}/hitl/${pendingHitlRequest.id}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            approved,
            comment: hitlComment.trim() || undefined,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `提交审批失败：${response.status}`);
      }

      const next = await fetchRunSnapshot(activeRunId);
      setSnapshot(next);
      setHitlComment("");
    } catch (respondError) {
      setError(
        respondError instanceof Error ? respondError.message : "提交审批失败。",
      );
    } finally {
      setIsRespondingToHitl(false);
    }
  }

  if (!hasStarted) {
    return (
      <section className="launch-screen" aria-label="Start an Agent run">
        <form
          className="launch-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void startRun();
          }}
        >
          <label className="sr-only" htmlFor="launch-prompt">
            输入你想让 Agent 完成的任务
          </label>
          <textarea
            id="launch-prompt"
            ref={launchPromptRef}
            className="launch-input"
            value={prompt}
            onChange={(event) => updatePrompt(event.currentTarget.value)}
            onInput={(event) => updatePrompt(event.currentTarget.value)}
            rows={3}
            placeholder="告诉 Agent 你想完成什么..."
            autoFocus
          />
          <button
            className="launch-submit"
            type="submit"
            disabled={!canSubmit}
            aria-label="开始执行"
          >
            {isSubmitting ? "..." : "开始"}
          </button>
        </form>
        {error ? <p className="error launch-error">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="workspace-grid" aria-label="Agent run workspace">
      <section className="panel prompt-console">
        <div className="console-header">
          <div>
            <p className="eyebrow">Start</p>
            <h2>启动一次 Agent Run</h2>
          </div>
          <span className="console-pill">{runPhase}</span>
        </div>

        <form
          className="run-form"
          onSubmit={(event) => {
            event.preventDefault();
            void startRun();
          }}
        >
          <label>
            场景模板
            <select
              value={agentCode}
              onChange={(event) => setAgentCode(event.target.value)}
            >
              <option value="contract-review">合同风险审查</option>
              <option value="compare-review">方案对比评审</option>
              <option value="mock-agent">通用 Prompt 收集</option>
            </select>
          </label>

          <label>
            用户意图
            <textarea
              value={prompt}
              onChange={(event) => updatePrompt(event.currentTarget.value)}
              onInput={(event) => updatePrompt(event.currentTarget.value)}
              rows={8}
              placeholder="像发消息一样描述目标、上下文、约束和希望得到的输出。"
            />
          </label>

          <div className="composer-actions">
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "发送中..." : "开始执行"}
            </button>
            <p className="muted">
              用自然语言描述目标，Runtime 会把过程、确认点和结果串起来。
            </p>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </form>

        <div className="intent-tips" aria-label="Prompt suggestions">
          <span>目标</span>
          <span>上下文</span>
          <span>约束</span>
          <span>输出格式</span>
        </div>
      </section>

      <section className="panel conversation-panel">
        <div className="summary-header">
          <div>
            <p className="eyebrow">Run Stream</p>
            <h2>{snapshot.run?.id ? "运行中的对话" : "等待任务"}</h2>
          </div>
          <span className={`status status-${snapshot.run?.status ?? "idle"}`}>
            {snapshot.run?.status ?? "idle"}
          </span>
        </div>

        <ConversationFeed
          prompt={prompt}
          run={snapshot.run}
          events={snapshot.events}
          artifacts={snapshot.artifacts}
          pendingHitlRequest={pendingHitlRequest}
        />

        <div className="result-dock" aria-label="Run result">
          <div className="summary-header">
            <div>
              <p className="eyebrow">Result</p>
              <h2>
                {latestArtifact ? latestArtifact.title : "结果将在这里出现"}
              </h2>
            </div>
            {latestArtifact ? (
              <span className="console-pill">{latestArtifact.status}</span>
            ) : null}
          </div>
          {snapshot.artifacts.length === 0 ? (
            <div className="empty-result">
              <strong>还没有产物</strong>
              <p className="muted">
                任务完成后，风险列表、审批记录或最终摘要会沉淀在这里。
              </p>
            </div>
          ) : (
            <div className="artifacts">
              {snapshot.artifacts.map((artifact) => (
                <article key={artifact.id} className="artifact-card">
                  <div className="artifact-title">
                    <h3>{artifact.title}</h3>
                    <span>{artifact.renderer}</span>
                  </div>
                  <p className="muted">
                    {artifact.type} · v{artifact.version} · {artifact.status}
                  </p>
                  <ArtifactBody artifact={artifact} />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="ops-rail" aria-label="Run operations">
        <section className="panel run-summary compact-panel">
          <div className="summary-header">
            <div>
              <p className="eyebrow">Snapshot</p>
              <h2>运行概览</h2>
            </div>
            <span className="console-pill">{isTerminal ? "完成" : "进行中"}</span>
          </div>

          <dl className="metrics">
            <div>
              <dt>Events</dt>
              <dd>{snapshot.events.length}</dd>
            </div>
            <div>
              <dt>Artifacts</dt>
              <dd>{snapshot.artifacts.length}</dd>
            </div>
            <div>
              <dt>HITL</dt>
              <dd>{snapshot.hitlRequests.length}</dd>
            </div>
            <div>
              <dt>AG-UI</dt>
              <dd>{agUiEventCount}</dd>
            </div>
          </dl>

          <div className="event-counts">
            {Object.entries(eventCounts).length === 0 ? (
              <span>等待 runtime event</span>
            ) : (
              Object.entries(eventCounts).map(([type, count]) => (
                <span key={type}>
                  {type}: {count}
                </span>
              ))
            )}
          </div>
        </section>

        <section className="panel runtime-stack compact-panel">
          <p className="eyebrow">UI Runtime</p>
          <h2>SDK 适配层</h2>
          <div className="stack-list">
            {agentUiStack.map((item) => (
              <div key={item.id}>
                <strong>{item.label}</strong>
                <p>{item.role}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel hitl-panel compact-panel">
          <p className="eyebrow">Checkpoint</p>
          <h2>人工确认</h2>
          {pendingHitlRequest ? (
            <div className="hitl-card">
              <div>
                <h3>{pendingHitlRequest.title}</h3>
                <p className="muted">
                  Runtime 已暂停，确认后会继续生成最终结果。
                </p>
              </div>
              <SchemaSummary schema={pendingHitlRequest.schema} />
              <label>
                审批意见
                <textarea
                  value={hitlComment}
                  onChange={(event) => setHitlComment(event.target.value)}
                  rows={3}
                  placeholder="可选：说明通过或拒绝原因"
                />
              </label>
              <div className="hitl-actions">
                <button
                  type="button"
                  onClick={() => void respondToHitl(true)}
                  disabled={isRespondingToHitl}
                >
                  {isRespondingToHitl ? "提交中..." : "批准继续"}
                </button>
                <button
                  className="secondary-danger"
                  type="button"
                  onClick={() => void respondToHitl(false)}
                  disabled={isRespondingToHitl}
                >
                  拒绝结束
                </button>
              </div>
            </div>
          ) : snapshot.hitlRequests.length > 0 ? (
            <div className="hitl-history">
              {snapshot.hitlRequests.map((request) => (
                <p key={request.id}>
                  {request.title}：<strong>{request.status}</strong>
                </p>
              ))}
            </div>
          ) : (
            <p className="muted">
              需要确认时，这里会像一个关键决策点一样出现。
            </p>
          )}
        </section>
      </aside>
    </section>
  );
}

function ConversationFeed({
  prompt,
  run,
  events,
  artifacts,
  pendingHitlRequest,
}: {
  prompt: string;
  run?: RunRecord;
  events: RuntimeEvent[];
  artifacts: Artifact[];
  pendingHitlRequest?: HitlRequest;
}) {
  const latestArtifact = artifacts[artifacts.length - 1];
  const latestEvent = events[events.length - 1];

  return (
    <div className="chat-feed" aria-live="polite">
      <article className="chat-message user-message">
        <span className="avatar">你</span>
        <div className="bubble">
          <strong>用户意图</strong>
          <p>{prompt.trim() || "先描述一个想收集、执行或沉淀的 Prompt。"}</p>
        </div>
      </article>

      <article className="chat-message agent-message">
        <span className="avatar">AI</span>
        <div className="bubble">
          <strong>{run ? "已接收，开始执行" : "准备收集意图"}</strong>
          <p>
            {run
              ? `Run ${run.id} 当前状态为 ${run.status}。`
              : "发送后，我会把事件进度、人工确认和最终结果持续渲染在这个对话里。"}
          </p>
        </div>
      </article>

      {events.map((event) => (
        <article
          key={event.id}
          className="chat-message agent-message subtle-message"
        >
          <span className="avatar">↻</span>
          <div className="bubble">
            <div className="event-meta">
              <strong>{formatEventTitle(event.type)}</strong>
              <time dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleTimeString()}
              </time>
            </div>
            <p>{summarizeEvent(event)}</p>
            <UiRenderPreview event={event} />
          </div>
        </article>
      ))}

      {pendingHitlRequest ? (
        <article className="chat-message agent-message checkpoint-message">
          <span className="avatar">?</span>
          <div className="bubble">
            <strong>{pendingHitlRequest.title}</strong>
            <p>这里需要人工确认，确认后我会继续生成最终结果。</p>
          </div>
        </article>
      ) : null}

      {latestArtifact ? (
        <article className="chat-message agent-message result-message">
          <span className="avatar">✓</span>
          <div className="bubble">
            <strong>最终结果已生成</strong>
            <p>
              {latestArtifact.title} · {latestArtifact.type} ·{" "}
              {latestArtifact.status}
            </p>
          </div>
        </article>
      ) : latestEvent ? null : (
        <article className="chat-message agent-message subtle-message">
          <span className="avatar">…</span>
          <div className="bubble">
            <strong>等待发送</strong>
            <p>这会是一个从意图到结果的连续工作流，而不是分散的技术面板。</p>
          </div>
        </article>
      )}
    </div>
  );
}

function UiRenderPreview({ event }: { event: RuntimeEvent }) {
  const envelope = runtimeEventToUiRender(event);

  if (!envelope) {
    return null;
  }

  return (
    <div className="ui-render-preview">
      <span>{envelope.event}</span>
      <code>{envelope.renderer}</code>
    </div>
  );
}

function getRunPhase(
  status: RunStatus | undefined,
  pendingHitlRequest?: HitlRequest,
): string {
  if (pendingHitlRequest) {
    return "等待确认";
  }

  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "执行中";
    case "waiting_for_hitl":
      return "等待确认";
    case "finished":
      return "已完成";
    case "failed":
      return "执行失败";
    case "cancelled":
      return "已取消";
    default:
      return "可发送";
  }
}

function formatEventTitle(eventType: RuntimeEvent["type"]): string {
  switch (eventType) {
    case "run_started":
      return "开始执行";
    case "message_delta":
      return "内容更新";
    case "tool_call_started":
      return "工具启动";
    case "tool_call_finished":
      return "工具完成";
    case "artifact_created":
      return "生成产物";
    case "hitl_required":
      return "需要确认";
    case "run_finished":
      return "执行完成";
    case "run_failed":
      return "执行失败";
    default:
      return eventType;
  }
}

function summarizeEvent(event: RuntimeEvent): string {
  switch (event.type) {
    case "run_started":
      return "Runtime 已经接收用户意图，正在组织任务上下文。";
    case "message_delta":
      return event.payload.content;
    case "tool_call_started":
      return `正在调用 ${event.payload.toolName}，补齐执行所需信息。`;
    case "tool_call_finished":
      return `${event.payload.toolName} 已完成，用时 ${event.payload.durationMs}ms。`;
    case "artifact_created":
      return "系统已经沉淀出一个可展示、可查询的结果产物。";
    case "hitl_required":
      return "执行暂停并等待人工确认，这是结果生成前的关键检查点。";
    case "run_finished":
      return "执行闭环完成，可以查看下方最终结果。";
    case "run_failed":
      return event.payload.error ?? "执行过程中出现错误。";
    default:
      return "收到一条 Runtime 事件，工作流仍在继续。";
  }
}

function SchemaSummary({ schema }: { schema: JsonSchemaLike }) {
  const fields = Object.entries(schema.properties ?? {});

  if (fields.length === 0) {
    return null;
  }

  return (
    <dl className="schema-summary">
      {fields.map(([name, field]) => (
        <div key={name}>
          <dt>{field.title ?? name}</dt>
          <dd>
            {name} · {field.type ?? "unknown"}
            {schema.required?.includes(name) ? " · required" : ""}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ArtifactBody({ artifact }: { artifact: Artifact }) {
  return <RenderedArtifactBody artifact={rendererRegistry.render(artifact)} />;
}

function RenderedArtifactBody({ artifact }: { artifact: RenderedArtifact }) {
  switch (artifact.kind) {
    case "risk_list":
      return (
        <div className="artifact-body">
          {artifact.markdown ? (
            <p className="artifact-markdown">{artifact.markdown}</p>
          ) : null}
          {artifact.risks.length === 0 ? (
            <p className="muted">未发现结构化风险项。</p>
          ) : (
            <ul className="risk-list">
              {artifact.risks.map((risk, index) => (
                <li key={`${risk.level}-${risk.title}-${index}`}>
                  <span className={`risk-level risk-${risk.level}`}>
                    {risk.level}
                  </span>
                  <strong>{risk.title}</strong>
                  {risk.description ? <p>{risk.description}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "markdown":
      return <p className="artifact-markdown">{artifact.markdown}</p>;
    case "diff":
      return <pre>{artifact.diff}</pre>;
    case "approval":
      return (
        <div className="artifact-body">
          <pre>{JSON.stringify(artifact.decision, null, 2)}</pre>
          {artifact.comment ? <p>{artifact.comment}</p> : null}
        </div>
      );
    case "workflow_trace":
      return <pre>{JSON.stringify(artifact.steps, null, 2)}</pre>;
    case "json":
      return <pre>{JSON.stringify(artifact.value, null, 2)}</pre>;
  }
}

async function fetchRunSnapshot(runId: string): Promise<RunSnapshot> {
  const [runResponse, eventsResponse, artifactsResponse, hitlResponse] =
    await Promise.all([
      fetch(`${apiBaseUrl}/runtime/runs/${runId}`, { cache: "no-store" }),
      fetch(`${apiBaseUrl}/runtime/runs/${runId}/events`, {
        cache: "no-store",
      }),
      fetch(`${apiBaseUrl}/runtime/runs/${runId}/artifacts`, {
        cache: "no-store",
      }),
      fetch(`${apiBaseUrl}/runtime/runs/${runId}/hitl`, { cache: "no-store" }),
    ]);

  if (!runResponse.ok) {
    throw new Error(`读取 run 失败：${runResponse.status}`);
  }

  const runBody = (await runResponse.json()) as { run: RunRecord };
  const eventsBody = eventsResponse.ok
    ? ((await eventsResponse.json()) as { events: RuntimeEvent[] })
    : { events: [] };
  const artifactsBody = artifactsResponse.ok
    ? ((await artifactsResponse.json()) as { artifacts: Artifact[] })
    : { artifacts: [] };
  const hitlBody = hitlResponse.ok
    ? ((await hitlResponse.json()) as { requests: HitlRequest[] })
    : { requests: [] };

  return {
    run: runBody.run,
    events: eventsBody.events,
    artifacts: artifactsBody.artifacts,
    hitlRequests: hitlBody.requests,
  };
}

function appendRuntimeEvent(
  events: RuntimeEvent[],
  event: RuntimeEvent,
): RuntimeEvent[] {
  if (events.some((existingEvent) => existingEvent.id === event.id)) {
    return events;
  }

  return [...events, event];
}

function updateRunFromEvent(
  run: RunRecord | undefined,
  event: RuntimeEvent,
): RunRecord | undefined {
  if (!run) {
    return run;
  }

  const status = getStatusFromEvent(event);

  if (!status) {
    return run;
  }

  return {
    ...run,
    status,
    updatedAt: event.createdAt,
    startedAt: event.type === "run_started" ? event.createdAt : run.startedAt,
    finishedAt:
      event.type === "run_finished" || event.type === "run_failed"
        ? event.createdAt
        : run.finishedAt,
    error: event.type === "run_failed" ? event.payload.error : run.error,
  };
}

function getStatusFromEvent(event: RuntimeEvent): RunStatus | undefined {
  switch (event.type) {
    case "run_started":
      return "running";
    case "hitl_required":
      return "waiting_for_hitl";
    case "run_finished":
      return "finished";
    case "run_failed":
      return "failed";
    default:
      return undefined;
  }
}

function isTerminalSnapshot(snapshot: RunSnapshot | undefined): boolean {
  return (
    snapshot?.run?.status === "finished" ||
    snapshot?.run?.status === "failed" ||
    snapshot?.run?.status === "cancelled"
  );
}
