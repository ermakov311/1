export interface File {
  id: string;
  name: string;
  content: string;
  language: 'cpp' | 'c';
}

export interface CompileResult {
  success: boolean;
  output: string;
  errors?: string;
}

export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: Array<{
    content: string;
    name?: string;
  }>;
  stdin?: string;
  args?: string[];
  compile_timeout?: number;
  run_timeout?: number;
  compile_memory_limit?: number;
  run_memory_limit?: number;
}

export interface PistonExecuteResponse {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    output: string;
    code: number;
    signal: string | null;
  };
  compile?: {
    stdout: string;
    stderr: string;
    output: string;
    code: number;
    signal: string | null;
  };
}