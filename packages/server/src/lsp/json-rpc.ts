import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

export class JsonRpcClient {
  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  constructor(private readonly proc: ChildProcessWithoutNullStreams) {
    proc.stdout.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      this.flush();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();
      if (text && !text.includes("indexing")) {
        console.debug(`[lsp stderr] ${text}`);
      }
    });

    proc.on("exit", (code) => {
      const error = new Error(`language server exited with code ${code ?? "unknown"}`);
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
    });
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  request(method: string, params: unknown, timeoutMs = 8_000): Promise<unknown> {
    const id = this.nextId++;
    const message = { jsonrpc: "2.0", id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LSP request timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      this.write(message);
    });
  }

  dispose(): void {
    this.proc.kill();
  }

  private write(message: JsonRpcMessage): void {
    const payload = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n`;
    this.proc.stdin.write(header + payload, "utf8");
  }

  private flush(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const header = this.buffer.slice(0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const length = Number(lengthMatch[1]);
      const start = headerEnd + 4;
      const end = start + length;
      if (this.buffer.length < end) {
        return;
      }

      const body = this.buffer.slice(start, end);
      this.buffer = this.buffer.slice(end);
      this.handleMessage(JSON.parse(body) as JsonRpcMessage);
    }
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }

      pending.resolve(message.result);
      return;
    }

    if (message.method) {
      this.onNotification?.(message.method, message.params);
    }
  }

  onNotification?: (method: string, params: unknown) => void;
}

export function spawnLanguageServer(command: string, args: string[]): ChildProcessWithoutNullStreams {
  const proc = spawn(command, args, {
    stdio: "pipe",
    env: process.env,
  });

  proc.on("error", () => {
    // Missing language server binaries must not crash coode-server.
  });

  return proc;
}
