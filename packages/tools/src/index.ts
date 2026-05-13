export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(input: TInput): Promise<TOutput>;
}
