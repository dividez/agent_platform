export const artifactTypes = [
  "markdown",
  "table",
  "diff",
  "workflow_trace",
  "risk_list",
  "approval",
  "document_linked",
  "html",
  "ui_spec",
] as const;

export type ArtifactType = (typeof artifactTypes)[number];

export type ArtifactStatus = "draft" | "created" | "updated" | "archived";

export interface Artifact<TSpec = unknown> {
  id: string;
  runId: string;
  type: ArtifactType;
  title: string;
  renderer: string;
  spec: TSpec;
  version: number;
  status: ArtifactStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  storageRef?: string;
  parentArtifactId?: string;
  metadata?: Record<string, unknown>;
}
