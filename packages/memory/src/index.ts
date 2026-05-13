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

export const vectorStoreProviders = [
  "pgvector",
  "qdrant",
  "milvus",
  "chroma",
  "pinecone",
  "weaviate",
] as const;

export type VectorStoreProviderName = (typeof vectorStoreProviders)[number];

export interface VectorStoreConfig {
  readonly provider: VectorStoreProviderName;
  readonly endpoint?: string;
  readonly apiKey?: string;
  readonly collection: string;
  readonly dimension: number;
  readonly namespace?: string;
  readonly databaseUrl?: string;
}

export interface VectorDocument<TMetadata = Record<string, unknown>> {
  readonly id: string;
  readonly content: string;
  readonly embedding: readonly number[];
  readonly metadata?: TMetadata;
}

export interface VectorSearchQuery<TFilter = Record<string, unknown>> {
  readonly embedding: readonly number[];
  readonly topK: number;
  readonly namespace?: string;
  readonly filter?: TFilter;
}

export interface VectorSearchResult<
  TMetadata = Record<string, unknown>,
> extends VectorDocument<TMetadata> {
  readonly score: number;
}

export interface VectorStoreProvider {
  readonly name: VectorStoreProviderName;
  upsert(documents: readonly VectorDocument[]): Promise<void>;
  search(query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  delete(ids: readonly string[], namespace?: string): Promise<void>;
}

export function isVectorStoreProvider(
  value: string,
): value is VectorStoreProviderName {
  return vectorStoreProviders.includes(value as VectorStoreProviderName);
}

export function createVectorStoreConfig(
  env: Record<string, string | undefined>,
): VectorStoreConfig {
  const providerValue = env.VECTOR_STORE_PROVIDER ?? "pgvector";

  if (!isVectorStoreProvider(providerValue)) {
    throw new Error(
      `Unsupported vector store provider "${providerValue}". Supported providers: ${vectorStoreProviders.join(", ")}`,
    );
  }

  return {
    provider: providerValue,
    endpoint: env.VECTOR_STORE_ENDPOINT,
    apiKey: env.VECTOR_STORE_API_KEY,
    collection: env.VECTOR_STORE_COLLECTION ?? "agent_memory",
    dimension: Number(env.VECTOR_STORE_DIMENSION ?? 1536),
    namespace: env.VECTOR_STORE_NAMESPACE,
    databaseUrl: env.VECTOR_STORE_DATABASE_URL ?? env.DATABASE_URL,
  };
}
