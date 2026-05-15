import type { Artifact } from "@agent-platform/artifact";

export type RenderedArtifact =
  | {
      kind: "markdown";
      markdown: string;
    }
  | {
      kind: "risk_list";
      markdown?: string;
      risks: RenderedRiskItem[];
    }
  | {
      kind: "diff";
      diff: string;
    }
  | {
      kind: "approval";
      decision: unknown;
      comment?: string;
    }
  | {
      kind: "workflow_trace";
      steps: unknown[];
    }
  | {
      kind: "json";
      value: unknown;
    };

export interface RenderedRiskItem {
  level: string;
  title: string;
  description?: string;
}

export interface ArtifactRenderer<TSpec = unknown, TResult = unknown> {
  renderer: string;
  type?: string;
  render(artifact: Artifact<TSpec>): TResult;
}

export interface RendererRegistry<TResult = unknown> {
  register(renderer: ArtifactRenderer<unknown, TResult>): void;
  get(renderer: string): ArtifactRenderer<unknown, TResult> | undefined;
  render(artifact: Artifact): TResult;
}

export class InMemoryRendererRegistry<TResult = unknown>
  implements RendererRegistry<TResult>
{
  private readonly renderers = new Map<
    string,
    ArtifactRenderer<unknown, TResult>
  >();

  constructor(private readonly fallback: ArtifactRenderer<unknown, TResult>) {
    this.register(fallback);
  }

  register(renderer: ArtifactRenderer<unknown, TResult>): void {
    this.renderers.set(renderer.renderer, renderer);

    if (renderer.type) {
      this.renderers.set(renderer.type, renderer);
    }
  }

  get(renderer: string): ArtifactRenderer<unknown, TResult> | undefined {
    return this.renderers.get(renderer);
  }

  render(artifact: Artifact): TResult {
    const renderer =
      this.renderers.get(artifact.renderer) ??
      this.renderers.get(artifact.type) ??
      this.fallback;

    return renderer.render(artifact);
  }
}

export function createDefaultRendererRegistry(): RendererRegistry<RenderedArtifact> {
  const registry = new InMemoryRendererRegistry<RenderedArtifact>({
    renderer: "json-renderer",
    type: "json",
    render: (artifact) => ({ kind: "json", value: artifact.spec }),
  });

  registry.register({
    renderer: "markdown-renderer",
    type: "markdown",
    render: (artifact) => ({
      kind: "markdown",
      markdown:
        readStringField(artifact.spec, "markdown") ?? String(artifact.spec),
    }),
  });

  registry.register({
    renderer: "risk-list-renderer",
    type: "risk_list",
    render: (artifact) => ({
      kind: "risk_list",
      markdown: readStringField(artifact.spec, "markdown"),
      risks: readRiskItems(artifact.spec),
    }),
  });

  registry.register({
    renderer: "diff-renderer",
    type: "diff",
    render: (artifact) => ({
      kind: "diff",
      diff: readStringField(artifact.spec, "diff") ?? String(artifact.spec),
    }),
  });

  registry.register({
    renderer: "approval-renderer",
    type: "approval",
    render: (artifact) => ({
      kind: "approval",
      decision: readObjectField(artifact.spec, "decision") ?? artifact.spec,
      comment: readStringField(artifact.spec, "comment"),
    }),
  });

  registry.register({
    renderer: "workflow-trace-renderer",
    type: "workflow_trace",
    render: (artifact) => ({
      kind: "workflow_trace",
      steps: readArrayField(artifact.spec, "steps"),
    }),
  });

  return registry;
}

function readStringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldValue = value[field];
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function readObjectField(
  value: unknown,
  field: string,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldValue = value[field];
  return isRecord(fieldValue) ? fieldValue : undefined;
}

function readArrayField(value: unknown, field: string): unknown[] {
  if (!isRecord(value)) {
    return [];
  }

  const fieldValue = value[field];
  return Array.isArray(fieldValue) ? fieldValue : [];
}

function readRiskItems(value: unknown): RenderedRiskItem[] {
  if (!isRecord(value) || !Array.isArray(value.risks)) {
    return [];
  }

  return value.risks.filter(isRiskItem).map((risk) => ({
    level: risk.level,
    title: risk.title,
    description: risk.description,
  }));
}

function isRiskItem(value: unknown): value is RenderedRiskItem {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.level === "string" && typeof value.title === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
