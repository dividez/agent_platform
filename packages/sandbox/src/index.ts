export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SandboxProvider {
  run(command: string, args?: string[]): Promise<SandboxCommandResult>;
}
