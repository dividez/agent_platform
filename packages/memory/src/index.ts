export interface MemoryRecord<TMetadata = Record<string, unknown>> {
  id: string;
  namespace: string;
  content: string;
  metadata?: TMetadata;
}

export interface MemoryProvider {
  remember(record: MemoryRecord): Promise<void>;
  recall(query: string): Promise<MemoryRecord[]>;
}
