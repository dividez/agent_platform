export const artifactTypes = [
  "markdown",
  "table",
  "diff",
  "workflow_trace",
  "risk_list",
  "approval",
  "document_linked",
  "html",
  "ui_spec"
] as const;

export type ArtifactType = (typeof artifactTypes)[number];

export interface Artifact<TSpec = unknown> {
  id: string;
  runId: string;
  type: ArtifactType;
  renderer: string;
  spec: TSpec;
}
