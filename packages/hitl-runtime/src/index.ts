export const hitlStatuses = [
  "created",
  "pending",
  "approved",
  "rejected",
  "expired",
  "cancelled",
] as const;

export type HitlStatus = (typeof hitlStatuses)[number];

export interface HitlRequest<TSchema = unknown, TResponse = unknown> {
  id: string;
  runId: string;
  title: string;
  schema: TSchema;
  status: HitlStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  response?: TResponse;
}

export interface HitlDecision {
  approved: boolean;
  comment?: string;
  values?: Record<string, unknown>;
}

export function isHitlDecision(value: unknown): value is HitlDecision {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.approved === "boolean";
}
