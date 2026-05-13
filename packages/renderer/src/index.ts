import type { Artifact } from "@agent-platform/artifact";

export interface ArtifactRenderer<TSpec = unknown, TResult = unknown> {
  type: string;
  render(artifact: Artifact<TSpec>): TResult;
}

export interface RendererRegistry {
  register(renderer: ArtifactRenderer): void;
  get(type: string): ArtifactRenderer | undefined;
}
