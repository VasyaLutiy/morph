// The one shared helpers module of {{name}}: every test takes its temporary trees, fixtures and stubs from here and
// never writes its own. Node's standard library only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface TmpRoot {
  root: string;
  path(rel: string): string;
  write(rel: string, text: string): string;
  read(rel: string): string;
  exists(rel: string): boolean;
  rm(): void;
}

export function tmpRoot(prefix = "{{name}}-"): TmpRoot {
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

export interface FakeClock {
  now(): number;
  advance(ms: number): void;
}

export function fakeClock(start = 0): FakeClock {
  let t = start;
  return {
    now(): number {
      return t;
    },
    advance(ms: number): void {
      t += ms;
    },
  };
}

export function fixturePath(name: string): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures", name);
}

export function fixture(name: string): string {
  return fs.readFileSync(fixturePath(name), "utf8");
}

export function fixtureJson(name: string): unknown {
  return JSON.parse(fixture(name));
}
