// P18 probe for parse-command by docs/TASK_P18_template.md §2.2 (src/cli/types.ts, parse.ts, main.ts) — init parsed with
// its flags and checks, the no-command message naming eleven commands, and the routing of init through main (root and
// templates resolved against cwd). Record Parse Command examples 8 and 21, Main example 16.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import type { CliDeps } from "../../src/cli/types.js";
import { fixturePath, fixtureJson, tmpRoot } from "../../tests/helpers.js";

const ARGV = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
const WANT = fixtureJson("cli/parse.json") as Record<string, unknown[]>;

function parsedAs(key: string): void {
  const got = ARGV[key].map((argv) => parseCommand(argv));
  expect(got.length).toBe(WANT[key].length);
  got.forEach((g, i) => expect([ARGV[key][i], g]).toStrictEqual([ARGV[key][i], WANT[key][i]]));
}

test("Parse Command example 8: --root as the last token, then no command (eleven commands)", () => {
  parsedAs("8");
});

test("Parse Command example 21: init, its flags and checks", () => {
  parsedAs("21");
});

function io(): { out: string[]; err: string[]; io: { stdout(t: string): void; stderr(t: string): void } } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } } };
}

test("Main example 16: init routed to the scaffold; a refusal; a usage error; root and templates against cwd", async () => {
  const t = tmpRoot();
  try {
    const deps: CliDeps = { env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: t.root, transport: null };
    const argv = ["init", "--root", "p", "--name", "acme", "--language", "go", "--module", "example.com/acme", "--templates", fixturePath("scaffold/tpl")];
    const a = io();
    expect([await main(argv, deps, a.io), a.err]).toStrictEqual([0, ["morph init: exit 0\n"]]);
    expect(a.out.length).toBe(1);
    expect(JSON.parse(a.out[0])).toStrictEqual({ name: "acme", language: "go", module: "example.com/acme",
      files: [".gitignore", "README.md", "docs/notes.md", "go.mod", "internal/keep.txt", "tools/hello.sh"] });
    expect(t.read("p/go.mod")).toBe("module example.com/acme\n\ngo 1.22\n");
    const b = io();
    expect([await main(argv, deps, b.io), b.err]).toStrictEqual([2, ["morph init: exit 2\n"]]);
    expect(b.out).toStrictEqual(["{\"error\":{\"code\":2,\"kind\":\"RefusalError\",\"message\":\"target directory is not empty (first entry: .gitignore)\"}}\n"]);
    const c = io();
    expect([await main(["init", "--name", "acme", "--language", "rust"], deps, c.io), c.err])
      .toStrictEqual([4, ["morph: --language must be one of typescript, python, go (got 'rust')\n"]]);
    t.write("t2/common/a.txt", "{{name}}\n");
    t.write("t2/python/b.txt", "{{language}}\n");
    const d = io();
    expect(await main(["init", "--root", "q", "--name", "b", "--language", "python", "--templates", "t2"], deps, d.io)).toBe(0);
    expect(JSON.parse(d.out[0])).toStrictEqual({ name: "b", language: "python", module: "b", files: ["a.txt", "b.txt"] });
    expect([t.read("q/a.txt"), t.read("q/b.txt")]).toStrictEqual(["b\n", "python\n"]);
  } finally {
    t.rm();
  }
});
