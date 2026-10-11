import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setImmediate as setImmediatePromise } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export interface TmpRoot {
  root: string;
  path(rel: string): string;
  write(rel: string, text: string): string;
  read(rel: string): string;
  exists(rel: string): boolean;
  rm(): void;
}

export function tmpRoot(prefix = "morph-"): TmpRoot {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  return {
    root,
    path(rel: string): string {
      return path.join(root, rel);
    },
    write(rel: string, text: string): string {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text, "utf8");
      return abs;
    },
    read(rel: string): string {
      return fs.readFileSync(path.join(root, rel), "utf8");
    },
    exists(rel: string): boolean {
      return fs.existsSync(path.join(root, rel));
    },
    rm(): void {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

export interface TmpRepo extends TmpRoot {
  git(args: readonly string[]): string;
}

export function tmpRepo(): TmpRepo {
  const base = tmpRoot("morph-repo-");
  const run = (args: readonly string[]): string => {
    try {
      return execFileSync("git", args, {
        cwd: base.root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
      }).trim();
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      throw new Error(err.stderr ?? err.message ?? "git failed");
    }
  };
  run(["init", "-q", "-b", "main"]);
  run(["config", "user.name", "morph"]);
  run(["config", "user.email", "morph@example.invalid"]);
  run(["config", "commit.gpgsign", "false"]);
  run(["commit", "--allow-empty", "-q", "-m", "init"]);
  return { ...base, git: run };
}

export type FakeReply =
  | { status?: number; body?: unknown; text?: string; headers?: Record<string, string> }
  | Error;

export interface FakeResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface FakeCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

export interface FakeFetch {
  fetch(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<FakeResponse>;
  calls: FakeCall[];
  set(url: string, reply: FakeReply): void;
  failAll(e: Error | null): void;
}

function replyText(reply: { status?: number; body?: unknown; text?: string }): string {
  if (reply.text !== undefined) return reply.text;
  if (reply.body !== undefined) return JSON.stringify(reply.body);
  return "";
}

export function fakeFetch(routes: Record<string, FakeReply> = {}): FakeFetch {
  const table = new Map<string, FakeReply>(Object.entries(routes));
  const calls: FakeCall[] = [];
  let failure: Error | null = null;
  const self: FakeFetch = {
    set(url: string, reply: FakeReply): void {
      table.set(url, reply);
    },
    failAll(e: Error | null): void {
      failure = e;
    },
    async fetch(
      url: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string },
    ): Promise<FakeResponse> {
      calls.push({
        url,
        method: (init?.method ?? "GET").toUpperCase(),
        headers: init?.headers ?? {},
        body: init?.body ?? null,
      });
      if (failure !== null) throw failure;
      const reply = table.get(url);
      if (reply === undefined) {
        return {
          ok: false,
          status: 404,
          headers: { get: (): null => null },
          text: async () => '{"error":"not found"}',
          json: async () => ({ error: "not found" }),
        };
      }
      if (reply instanceof Error) throw reply;
      const status = reply.status ?? 200;
      const headers: Record<string, string> = reply.headers ?? {};
      const lowered: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = v;
      const text = replyText(reply);
      return {
        ok: status >= 200 && status <= 299,
        status,
        headers: {
          get(name: string): string | null {
            return lowered[name.toLowerCase()] ?? null;
          },
        },
        async text(): Promise<string> {
          return text;
        },
        async json(): Promise<unknown> {
          return JSON.parse(text);
        },
      };
    },
    get calls(): FakeCall[] {
      return calls;
    },
  };
  return self;
}

export interface FakeClock {
  now(): number;
  sleep(ms: number): Promise<void>;
  advance(ms: number): Promise<void>;
  pending(): number[];
}

interface Timer {
  due: number;
  order: number;
  resolve(): void;
  resolved: boolean;
}

export function fakeClock(start = 0): FakeClock {
  let current = start;
  let order = 0;
  const timers: Timer[] = [];
  return {
    now(): number {
      return current;
    },
    sleep(ms: number): Promise<void> {
      return new Promise<void>((resolve) => {
        timers.push({ due: current + ms, order: order++, resolve, resolved: false });
      });
    },
    async advance(ms: number): Promise<void> {
      current += ms;
      const due = timers
        .filter((t) => !t.resolved && t.due <= current)
        .sort((a, b) => a.due - b.due || a.order - b.order);
      for (const t of due) {
        t.resolved = true;
        t.resolve();
      }
      await flush();
    },
    pending(): number[] {
      return timers.filter((t) => !t.resolved).map((t) => t.due).sort((a, b) => a - b);
    },
  };
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await setImmediatePromise();
  }
}

export function fixturePath(name: string): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures",
    name,
  );
}

export function fixture(name: string): string {
  return fs.readFileSync(fixturePath(name), "utf8");
}

export function fixtureJson(name: string): unknown {
  return JSON.parse(fixture(name));
}
