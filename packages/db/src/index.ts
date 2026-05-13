export interface TransactionContext {
  readonly id: string;
}

export interface DatabaseProvider {
  readonly dialect: string;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
