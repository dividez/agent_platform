export const databaseProviders = ["postgres", "mysql", "sqlite"] as const;

export type DatabaseProviderName = (typeof databaseProviders)[number];

export interface TransactionContext {
  readonly id: string;
}

export interface DatabaseConnectionConfig {
  readonly provider: DatabaseProviderName;
  readonly url: string;
  readonly schema?: string;
  readonly pool?: {
    readonly min?: number;
    readonly max?: number;
  };
}

export interface MigrationConfig {
  readonly enabled: boolean;
  readonly directory: string;
  readonly tableName: string;
  readonly runOnStartup: boolean;
}

export interface DatabaseRuntimeConfig {
  readonly connection: DatabaseConnectionConfig;
  readonly migrations: MigrationConfig;
}

export interface MigrationRecord {
  readonly id: string;
  readonly checksum: string;
  readonly appliedAt: string;
}

export interface MigrationStep {
  readonly id: string;
  readonly provider: DatabaseProviderName;
  readonly path: string;
  readonly checksum?: string;
}

export interface DatabaseProvider {
  readonly name: DatabaseProviderName;
  readonly dialect: string;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
  healthCheck?(): Promise<{ ok: boolean; message?: string }>;
}

export interface DatabaseMigrationProvider {
  readonly provider: DatabaseProviderName;
  listApplied(): Promise<MigrationRecord[]>;
  apply(step: MigrationStep): Promise<MigrationRecord>;
}

export function isDatabaseProvider(
  value: string,
): value is DatabaseProviderName {
  return databaseProviders.includes(value as DatabaseProviderName);
}

export function getDefaultDatabaseUrl(provider: DatabaseProviderName): string {
  switch (provider) {
    case "postgres":
      return "postgres://agent:agent@localhost:5432/agent_platform";
    case "mysql":
      return "mysql://agent:agent@localhost:3306/agent_platform";
    case "sqlite":
      return "file:./data/agent-platform.db";
  }
}

export function createDatabaseRuntimeConfig(
  env: Record<string, string | undefined>,
): DatabaseRuntimeConfig {
  const providerValue =
    env.DATABASE_PROVIDER ?? env.INFRA_DATABASE_PROVIDER ?? "postgres";

  if (!isDatabaseProvider(providerValue)) {
    throw new Error(
      `Unsupported database provider "${providerValue}". Supported providers: ${databaseProviders.join(", ")}`,
    );
  }

  const minPool = env.DATABASE_POOL_MIN
    ? Number(env.DATABASE_POOL_MIN)
    : undefined;
  const maxPool = env.DATABASE_POOL_MAX
    ? Number(env.DATABASE_POOL_MAX)
    : undefined;

  return {
    connection: {
      provider: providerValue,
      url: env.DATABASE_URL ?? getDefaultDatabaseUrl(providerValue),
      schema: env.DATABASE_SCHEMA,
      pool:
        minPool === undefined && maxPool === undefined
          ? undefined
          : {
              min: minPool,
              max: maxPool,
            },
    },
    migrations: {
      enabled: env.DATABASE_MIGRATIONS_ENABLED !== "false",
      directory:
        env.DATABASE_MIGRATIONS_DIR ?? `migrations/sql/${providerValue}`,
      tableName: env.DATABASE_MIGRATIONS_TABLE ?? "agent_platform_migrations",
      runOnStartup: env.DATABASE_MIGRATIONS_RUN_ON_STARTUP === "true",
    },
  };
}
