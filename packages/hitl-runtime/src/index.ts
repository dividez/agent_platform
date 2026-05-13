export interface HitlRequest<TSchema = unknown> {
  id: string;
  runId: string;
  schema: TSchema;
  status: "pending" | "approved" | "rejected";
}
