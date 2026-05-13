export const objectStorageProviders = [
  "s3",
  "minio",
  "gcs",
  "azure-blob",
  "filesystem",
] as const;

export type ObjectStorageProviderName = (typeof objectStorageProviders)[number];

export interface ObjectStorageConfig {
  readonly provider: ObjectStorageProviderName;
  readonly endpoint?: string;
  readonly region?: string;
  readonly bucket: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly forcePathStyle: boolean;
  readonly basePath?: string;
}

export interface ObjectReference {
  readonly bucket: string;
  readonly key: string;
  readonly versionId?: string;
}

export interface PutObjectInput {
  readonly key: string;
  readonly body: Uint8Array | ReadableStream | string;
  readonly contentType?: string;
  readonly metadata?: Record<string, string>;
}

export interface GetObjectResult {
  readonly body: Uint8Array | ReadableStream;
  readonly contentType?: string;
  readonly metadata?: Record<string, string>;
}

export interface ObjectStorageProvider {
  readonly name: ObjectStorageProviderName;
  putObject(input: PutObjectInput): Promise<ObjectReference>;
  getObject(reference: ObjectReference): Promise<GetObjectResult>;
  deleteObject(reference: ObjectReference): Promise<void>;
  createSignedUrl?(
    reference: ObjectReference,
    expiresInSeconds: number,
  ): Promise<string>;
}

export function isObjectStorageProvider(
  value: string,
): value is ObjectStorageProviderName {
  return objectStorageProviders.includes(value as ObjectStorageProviderName);
}

export function createObjectStorageConfig(
  env: Record<string, string | undefined>,
): ObjectStorageConfig {
  const providerValue = env.OBJECT_STORAGE_PROVIDER ?? "minio";

  if (!isObjectStorageProvider(providerValue)) {
    throw new Error(
      `Unsupported object storage provider "${providerValue}". Supported providers: ${objectStorageProviders.join(", ")}`,
    );
  }

  return {
    provider: providerValue,
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    region: env.OBJECT_STORAGE_REGION,
    bucket: env.OBJECT_STORAGE_BUCKET ?? "agent-platform",
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
    basePath: env.OBJECT_STORAGE_BASE_PATH,
  };
}
