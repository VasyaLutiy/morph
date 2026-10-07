import { expect, test } from "vitest";
import { main } from "../../src/cli/main.js";
import { tmpRepo, tmpRoot } from "../helpers.js";
import type { CliDeps, CliIo } from "../../src/cli/types.js";

interface Recorder {
  stdout: string[];
  stderr: string[];
  io: CliIo;
}

function recorder(): Recorder {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (text: string): void => {
        stdout.push(text);
      },
      stderr: (text: string): void => {
        stderr.push(text);
      },
    },
  };
}

function deps(): CliDeps {
  return { env: { PATH: process.env.PATH ?? "" }, now: () => 1791400000000, cwd: "/", transport: null };
}

test("Main example 9: primer writes .morph/primer.md and fails outside a repository", async () => {
  const t = tmpRepo();
  const other = tmpRoot();
  try {
    t.write("tests/a.test.ts", "test(\"a\", () => {});\nit(\"b\", () => {});\n");

    const first = recorder();
    const code = await main(["primer", "--write", "--root", t.root], deps(), first.io);
    expect(code).toBe(0);
    expect(first.stderr).toStrictEqual(["morph primer: exit 0\n"]);
    expect(first.stdout.length).toBe(1);
    const document = JSON.parse(first.stdout[0]) as { tests: unknown; written: unknown; markdown: unknown };
    expect(document.tests).toStrictEqual({ language: "typescript", files: 1, tests: 2 });
    expect(document.written).toBe(".morph/primer.md");
    expect(document.markdown).toBe(t.read(".morph/primer.md"));

    const second = recorder();
    const secondCode = await main(["primer", "--root", other.root], deps(), second.io);
    expect(secondCode).toBe(3);
    expect(second.stderr).toStrictEqual(["morph primer: exit 3\n"]);
    expect(second.stdout.length).toBe(1);
    const failure = JSON.parse(second.stdout[0]) as { error: { code: unknown; kind: unknown; message: string } };
    expect(failure.error.code).toBe(3);
    expect(failure.error.kind).toBe("RuntimeError");
    expect(failure.error.message.startsWith("git ls-files failed (exit 128): ")).toBe(true);
  } finally {
    t.rm();
    other.rm();
  }
});
