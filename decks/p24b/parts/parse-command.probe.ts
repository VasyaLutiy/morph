// P24b probe for parse-command by docs/TASK_P24b_group.md §2.2 (src/cli/types.ts, parse.ts, main.ts) — issue #16, the
// group accept's flags and route. Record Parse Command example 25, Main example 18.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import { fixture, fixtureJson, tmpRepo } from "../../tests/helpers.js";

test("Parse Command example 25: accept takes an id list, --from-run and --pick; card does not", () => {
  const argv = (fixtureJson("cli/parseArgv.json") as Record<string, string[][]>)["25"];
  const want = (fixtureJson("cli/parse.json") as Record<string, unknown[]>)["25"];
  expect(argv.map((a) => parseCommand(a))).toStrictEqual(want);
});

test("Main example 18: an id list with --from-run is a group; a single id with --from-run too", async () => {
  const t = tmpRepo();
  try {
    t.write("d.json", fixture("debt/group.deck.json"));
    t.write("src/lib.ts", "export const lib = 1;\n");
    t.write("src/use.ts", "export const use = 1;\n");
    t.write("README.md", "r\n");
    t.git(["add", "."]);
    t.git(["commit", "-q", "-m", "base"]);
    const g = fixtureJson("debt/group.run.json") as { report: unknown; answers: Record<string, string> };
    t.write(".morph/runs/r1/report.json", JSON.stringify(g.report));
    for (const [k, v] of Object.entries(g.answers)) t.write(".morph/runs/r1/answers/" + k + ".answer.txt", v);
    const deps = { env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: t.root, transport: null };
    const out: string[] = [];
    const err: string[] = [];
    const io = { stdout: (s: string) => { out.push(s); }, stderr: (s: string) => { err.push(s); } };
    const code = await main(["accept", "--deck", "d.json", "--id", "use,lib", "--from-run", "r1", "--commit"], deps, io);
    const doc = JSON.parse(out[0]) as { run: string; cards: { card: string; variant: string; green: boolean }[];
      outside: string[]; green: boolean; committed: number; restored: boolean; reason: string | null };
    expect([code, out.length, doc.run, doc.cards.map((c) => [c.card, c.variant, c.green]), doc.outside, doc.green,
      doc.committed, doc.restored, doc.reason, err]).toStrictEqual([0, 1, "r1", [["lib", "lib.v1", true], ["use", "use.v1", true]],
      [], true, 2, false, null, ["morph accept: exit 0\n"]]);
    expect(t.git(["log", "-1", "--format=%B"])).toBe("morph use: src/use.ts\n\nMorph-Card: use\n" +
      "Morph-Model: deepseek/deepseek-v4.1-flash\nMorph-Variant: use.v1\nMorph-Run: r1\nMorph-Acceptance-Exit: 0");
    out.length = 0;
    err.length = 0;
    const two = await main(["accept", "--deck", "d.json", "--id", "lib", "--from-run", "r1", "--pick", "lib.v2"], deps, io);
    expect([two, JSON.parse(out[0]), err]).toStrictEqual([2, { error: { code: 2, kind: "RefusalError",
      message: "no request lib.v2 in .morph/runs/r1/report.json" } }, ["morph accept: exit 2\n"]]);
  } finally {
    t.rm();
  }
}, 60000);
