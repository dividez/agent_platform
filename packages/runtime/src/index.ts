import type { Artifact, ArtifactType } from "@agent-platform/artifact";
import type { HitlDecision, HitlRequest } from "@agent-platform/hitl-runtime";
import type {
  RuntimeEvent,
  RuntimeEventPayload,
  RuntimeEventType,
  RunStatus,
} from "@agent-platform/protocol";

export interface RuntimeEventBus {
  publish(event: RuntimeEvent): Promise<void>;
  subscribe(runId: string): AsyncIterable<RuntimeEvent>;
}

export interface AgentRuntime {
  startRun(input: StartRunInput): Promise<{ runId: string }>;
  respondToHitl(input: RespondToHitlInput): Promise<{ runId: string }>;
}

export interface StartRunInput {
  agentCode: string;
  prompt: string;
}

export interface RespondToHitlInput {
  runId: string;
  requestId: string;
  decision: HitlDecision;
}

export interface RunRecord {
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

export interface RunStore {
  createRun(input: StartRunInput): Promise<RunRecord>;
  getRun(runId: string): Promise<RunRecord | undefined>;
  listRuns(): Promise<RunRecord[]>;
  updateRun(runId: string, patch: Partial<RunRecord>): Promise<RunRecord>;
  appendEvent(event: RuntimeEvent): Promise<void>;
  listEvents(runId: string): Promise<RuntimeEvent[]>;
  appendArtifact(artifact: Artifact): Promise<void>;
  listArtifacts(runId: string): Promise<Artifact[]>;
  createHitlRequest(input: {
    runId: string;
    title: string;
    schema: unknown;
  }): Promise<HitlRequest>;
  getHitlRequest(requestId: string): Promise<HitlRequest | undefined>;
  listHitlRequests(runId: string): Promise<HitlRequest[]>;
  resolveHitlRequest(
    requestId: string,
    decision: HitlDecision,
  ): Promise<HitlRequest<unknown, HitlDecision>>;
}

export class InMemoryRunStore implements RunStore {
  private readonly runs = new Map<string, RunRecord>();
  private readonly events = new Map<string, RuntimeEvent[]>();
  private readonly artifacts = new Map<string, Artifact[]>();
  private readonly hitlRequests = new Map<string, HitlRequest>();
  private readonly hitlRequestIdsByRun = new Map<string, string[]>();

  async createRun(input: StartRunInput): Promise<RunRecord> {
    const now = new Date().toISOString();
    const run: RunRecord = {
      id: createId("run"),
      agentCode: input.agentCode,
      prompt: input.prompt,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };

    this.runs.set(run.id, run);
    this.events.set(run.id, []);
    this.artifacts.set(run.id, []);
    this.hitlRequestIdsByRun.set(run.id, []);

    return run;
  }

  async getRun(runId: string): Promise<RunRecord | undefined> {
    return this.runs.get(runId);
  }

  async listRuns(): Promise<RunRecord[]> {
    return [...this.runs.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async updateRun(
    runId: string,
    patch: Partial<RunRecord>,
  ): Promise<RunRecord> {
    const current = this.runs.get(runId);

    if (!current) {
      throw new Error(`Run ${runId} not found`);
    }

    const next: RunRecord = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };

    this.runs.set(runId, next);
    return next;
  }

  async appendEvent(event: RuntimeEvent): Promise<void> {
    const events = this.events.get(event.runId) ?? [];
    events.push(event);
    this.events.set(event.runId, events);
  }

  async listEvents(runId: string): Promise<RuntimeEvent[]> {
    return [...(this.events.get(runId) ?? [])];
  }

  async appendArtifact(artifact: Artifact): Promise<void> {
    const artifacts = this.artifacts.get(artifact.runId) ?? [];
    artifacts.push(artifact);
    this.artifacts.set(artifact.runId, artifacts);
  }

  async listArtifacts(runId: string): Promise<Artifact[]> {
    return [...(this.artifacts.get(runId) ?? [])];
  }

  async createHitlRequest(input: {
    runId: string;
    title: string;
    schema: unknown;
  }): Promise<HitlRequest> {
    const now = new Date().toISOString();
    const request: HitlRequest = {
      id: createId("hitl"),
      runId: input.runId,
      title: input.title,
      schema: input.schema,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    this.hitlRequests.set(request.id, request);
    this.hitlRequestIdsByRun.set(input.runId, [
      ...(this.hitlRequestIdsByRun.get(input.runId) ?? []),
      request.id,
    ]);

    return request;
  }

  async getHitlRequest(requestId: string): Promise<HitlRequest | undefined> {
    return this.hitlRequests.get(requestId);
  }

  async listHitlRequests(runId: string): Promise<HitlRequest[]> {
    return (this.hitlRequestIdsByRun.get(runId) ?? [])
      .map((requestId) => this.hitlRequests.get(requestId))
      .filter((request): request is HitlRequest => Boolean(request));
  }

  async resolveHitlRequest(
    requestId: string,
    decision: HitlDecision,
  ): Promise<HitlRequest<unknown, HitlDecision>> {
    const current = this.hitlRequests.get(requestId);

    if (!current) {
      throw new Error(`HITL request ${requestId} not found`);
    }

    if (current.status !== "pending") {
      throw new Error(`HITL request ${requestId} is already ${current.status}`);
    }

    const now = new Date().toISOString();
    const next: HitlRequest<unknown, HitlDecision> = {
      ...current,
      status: decision.approved ? "approved" : "rejected",
      response: decision,
      resolvedAt: now,
      updatedAt: now,
    };

    this.hitlRequests.set(requestId, next);
    return next;
  }
}

export class InMemoryEventBus implements RuntimeEventBus {
  private readonly subscribers = new Map<
    string,
    Set<(event: RuntimeEvent) => void>
  >();

  async publish(event: RuntimeEvent): Promise<void> {
    for (const notify of this.subscribers.get(event.runId) ?? []) {
      notify(event);
    }
  }

  subscribe(runId: string): AsyncIterable<RuntimeEvent> {
    const subscribers = this.subscribers;

    return {
      [Symbol.asyncIterator]() {
        const queue: RuntimeEvent[] = [];
        let pendingResolve:
          | ((result: IteratorResult<RuntimeEvent>) => void)
          | undefined;

        const notify = (event: RuntimeEvent) => {
          if (pendingResolve) {
            pendingResolve({ value: event, done: false });
            pendingResolve = undefined;
            return;
          }

          queue.push(event);
        };

        const runSubscribers = subscribers.get(runId) ?? new Set();
        runSubscribers.add(notify);
        subscribers.set(runId, runSubscribers);

        return {
          next(): Promise<IteratorResult<RuntimeEvent>> {
            const event = queue.shift();

            if (event) {
              return Promise.resolve({ value: event, done: false });
            }

            return new Promise((resolve) => {
              pendingResolve = resolve;
            });
          },
          return(): Promise<IteratorResult<RuntimeEvent>> {
            runSubscribers.delete(notify);

            if (runSubscribers.size === 0) {
              subscribers.delete(runId);
            }

            if (pendingResolve) {
              pendingResolve({ value: undefined, done: true });
              pendingResolve = undefined;
            }

            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
  }
}

export class MockAgentRuntime implements AgentRuntime {
  constructor(
    private readonly store: RunStore,
    private readonly eventBus: RuntimeEventBus,
  ) {}

  async startRun(input: StartRunInput): Promise<{ runId: string }> {
    const run = await this.store.createRun(input);

    void this.executeRun(run.id).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.updateRun(run.id, {
        status: "failed",
        error: message,
        finishedAt: new Date().toISOString(),
      });
      await this.emit(run.id, "run_failed", {
        status: "failed",
        error: message,
      });
    });

    return { runId: run.id };
  }

  async respondToHitl(input: RespondToHitlInput): Promise<{ runId: string }> {
    const run = await this.store.getRun(input.runId);

    if (!run) {
      throw new Error(`Run ${input.runId} not found`);
    }

    const request = await this.store.getHitlRequest(input.requestId);

    if (!request || request.runId !== input.runId) {
      throw new Error(`HITL request ${input.requestId} not found`);
    }

    if (run.status !== "waiting_for_hitl") {
      throw new Error(`Run ${input.runId} is not waiting for HITL`);
    }

    const resolvedRequest = await this.store.resolveHitlRequest(
      input.requestId,
      input.decision,
    );

    await this.store.updateRun(input.runId, { status: "running" });
    await this.emit(input.runId, "message_delta", {
      role: "system",
      content: input.decision.approved
        ? "人工审批已通过，Runtime 继续执行。"
        : "人工审批已拒绝，Runtime 记录审批结果并结束。",
      sequence: 2,
    });

    const artifact = createApprovalArtifact(run, resolvedRequest);
    await this.store.appendArtifact(artifact);
    await this.emit(input.runId, "artifact_created", {
      artifactId: artifact.id,
      type: artifact.type,
      renderer: artifact.renderer,
      title: artifact.title,
    });

    await delay(120);
    await this.store.updateRun(input.runId, {
      status: "finished",
      finishedAt: new Date().toISOString(),
    });
    await this.emit(input.runId, "run_finished", {
      status: "finished",
      message: input.decision.approved
        ? "HITL approved. Mock contract review run finished."
        : "HITL rejected. Mock contract review run stopped with audit artifact.",
    });

    return { runId: input.runId };
  }

  private async executeRun(runId: string): Promise<void> {
    const run = await this.store.getRun(runId);

    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    await this.store.updateRun(runId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    await this.emit(runId, "run_started", {
      agentCode: run.agentCode,
      prompt: run.prompt,
    });

    await delay(220);
    await this.emit(runId, "message_delta", {
      role: "assistant",
      content: `已接收任务：${run.prompt}`,
      sequence: 1,
    });

    const toolCallId = createId("tool");
    await delay(220);
    await this.emit(runId, "tool_call_started", {
      toolCallId,
      toolName: "mock_analysis",
      input: {
        prompt: run.prompt,
        agentCode: run.agentCode,
      },
    });

    await delay(320);
    await this.emit(runId, "tool_call_finished", {
      toolCallId,
      toolName: "mock_analysis",
      output: {
        riskCount: 3,
        summary: "Mock runtime completed deterministic analysis.",
      },
      durationMs: 320,
    });

    const artifact = createMockArtifact(runId, run.prompt, run.agentCode);
    await this.store.appendArtifact(artifact);
    await delay(160);
    await this.emit(runId, "artifact_created", {
      artifactId: artifact.id,
      type: artifact.type,
      renderer: artifact.renderer,
      title: artifact.title,
    });

    if (run.agentCode === "contract-review") {
      const request = await this.store.createHitlRequest({
        runId,
        title: "确认是否应用合同审查修订",
        schema: createContractReviewApprovalSchema(),
      });

      await delay(160);
      await this.store.updateRun(runId, { status: "waiting_for_hitl" });
      await this.emit(runId, "hitl_required", {
        requestId: request.id,
        title: request.title,
        schema: request.schema,
      });
      return;
    }

    await this.finishRun(runId, "Mock run finished and produced one artifact.");
  }

  private async finishRun(runId: string, message: string): Promise<void> {
    await delay(160);
    await this.store.updateRun(runId, {
      status: "finished",
      finishedAt: new Date().toISOString(),
    });
    await this.emit(runId, "run_finished", {
      status: "finished",
      message,
    });
  }

  private async emit<TType extends RuntimeEventType>(
    runId: string,
    type: TType,
    payload: RuntimeEventPayload<TType>,
  ): Promise<void> {
    const event = {
      id: createId("evt"),
      runId,
      type,
      payload,
      createdAt: new Date().toISOString(),
    } as RuntimeEvent;

    await this.store.appendEvent(event);
    await this.eventBus.publish(event);
  }
}

export function createRuntimeServices(): {
  store: InMemoryRunStore;
  eventBus: InMemoryEventBus;
  runtime: MockAgentRuntime;
} {
  const store = new InMemoryRunStore();
  const eventBus = new InMemoryEventBus();
  const runtime = new MockAgentRuntime(store, eventBus);

  return { store, eventBus, runtime };
}

function createMockArtifact(
  runId: string,
  prompt: string,
  agentCode: string,
): Artifact<{
  markdown: string;
  risks: Array<{ level: string; title: string; description?: string }>;
}> {
  const now = new Date().toISOString();
  const type: ArtifactType = "risk_list";

  return {
    id: createId("art"),
    runId,
    type,
    title: "Mock Risk Review",
    renderer: "risk-list-renderer",
    spec: {
      markdown: `# Agent Run Result\n\n- Agent: ${agentCode}\n- Prompt: ${prompt}\n- Runtime: mock vertical slice`,
      risks: [
        {
          level: "medium",
          title: "真实 LLM adapter 尚未接入",
          description: "当前审查结果来自确定性的 MockAgentRuntime。",
        },
        {
          level: "medium",
          title: "事件存储目前为内存实现",
          description: "API 重启后 run、event、artifact 会丢失。",
        },
        {
          level: "low",
          title: "需要人工确认是否应用修订",
          description: "contract-review 会暂停并等待 HITL 审批。",
        },
      ],
    },
    version: 1,
    status: "created",
    createdAt: now,
    updatedAt: now,
    createdBy: "mock-runtime",
    metadata: {
      agentCode,
      verticalSlice: "phase-1-hitl",
    },
  };
}

function createApprovalArtifact(
  run: RunRecord,
  request: HitlRequest<unknown, HitlDecision>,
): Artifact<{
  decision: HitlDecision;
  request: Pick<HitlRequest, "id" | "title" | "status" | "createdAt" | "resolvedAt">;
  audit: {
    runId: string;
    agentCode: string;
    prompt: string;
    resolvedBy: string;
  };
}> {
  const now = new Date().toISOString();

  return {
    id: createId("art"),
    runId: run.id,
    type: "approval",
    title: request.response?.approved ? "HITL Approval" : "HITL Rejection",
    renderer: "approval-renderer",
    spec: {
      decision: request.response ?? { approved: false },
      request: {
        id: request.id,
        title: request.title,
        status: request.status,
        createdAt: request.createdAt,
        resolvedAt: request.resolvedAt,
      },
      audit: {
        runId: run.id,
        agentCode: run.agentCode,
        prompt: run.prompt,
        resolvedBy: "human-operator",
      },
    },
    version: 1,
    status: "created",
    createdAt: now,
    updatedAt: now,
    createdBy: "hitl-runtime",
    metadata: {
      hitlRequestId: request.id,
      approved: request.response?.approved ?? false,
    },
  };
}

function createContractReviewApprovalSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Contract Review Approval",
    type: "object",
    properties: {
      approved: {
        type: "boolean",
        title: "是否应用修订",
      },
      comment: {
        type: "string",
        title: "审批意见",
      },
    },
    required: ["approved"],
  };
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
