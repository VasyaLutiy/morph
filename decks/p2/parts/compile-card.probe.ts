// P2 probe for compile-card: compileCard by docs/TASK_P2_compiler.md §2.2, one test per record
// example, values and types. Runs from probe/compile-card/ under vitest; the root is the
// fixture tree tests/fixtures/compiler/project (read only).
import { test, expect } from "vitest";
import { compileCard } from "../../src/compiler/compile.js";
import type { CompileResult, InputDigest, Message, Request, Role } from "../../src/compiler/types.js";
import { validateCard } from "../../src/cards/model.js";
import type { Card, Fault } from "../../src/cards/types.js";
import { fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";

const ROOT = fixturePath("compiler/project");

function card(name: string, patch: Record<string, unknown> = {}): Card {
  const r = validateCard({ ...(fixtureJson(`compiler/cards/${name}.json`) as Record<string, unknown>), ...patch });
  if (!r.ok) throw new Error("fixture card invalid: " + r.faults.map((f) => f.message).join("; "));
  return r.card;
}
function okOf(r: CompileResult): { requests: Request[]; inputs: InputDigest } {
  if (!r.ok) throw new Error("expected ok, got faults: " + r.faults.map((f) => f.message).join("; "));
  return r;
}
function faultsOf(r: CompileResult): Fault[] {
  if (r.ok) throw new Error("expected faults, got " + r.requests.length + " requests");
  return r.faults;
}
const heads = (m: Message[]): string => m.map((x) => `${x.role}:${x.content.split("\n")[0]}`).join(" | ");

const A_MD = "Contents of file docs/A.md:\n```md\n# A\n\nAlpha doc.\n```";
const B_MD = "Contents of file docs/B.md:\n```md\n# B\n\nBeta doc.\n```";
const X_TS = "Original file src/x.ts:\n```ts\nexport const x = 1;\nexport const y = 2;\nexport const z = 3;\n```";

test("Compile Card example 1: generate, slice [docs/B.md, docs/A.md], variants 2", () => {
  const r = okOf(compileCard(card("generateA"), ROOT));
  expect(r.requests.map((q) => q.customId).join(","), "two Requests").toBe("a.v1,a.v2");
  const m: Message[] = r.requests[0]?.messages ?? [];
  expect(heads(m), "sorted slice, then the instruction").toBe(
    "user:Contents of file docs/A.md: | user:Contents of file docs/B.md: | user:Write src/a.ts.");
  expect(m[0]?.content, "messages[0] is docs/A.md fenced").toBe(A_MD);
  expect(m[1]?.content, "messages[1] is docs/B.md fenced").toBe(B_MD);
  expect(m[2]?.content, "messages[2] is instruction + directive").toBe(
    "Write src/a.ts.\n\nAnswer with the complete new content of src/a.ts in one fenced block and nothing else.");
  expect(JSON.stringify(r.requests[1]?.messages), "identical messages across variants").toBe(JSON.stringify(m));
  expect(r.requests[1]?.messages === r.requests[0]?.messages, "own array per request").toBe(false);
  expect(`${r.requests[0]?.model} ${r.requests[0]?.maxTokens} ${r.requests[0]?.reasoning}`, "nullable fields copied").toBe("null null null");
  expect(JSON.stringify(r.inputs), "inputs captured").toBe(
    '{"docs/A.md":"5ab70d8e40bc35ca","docs/B.md":"18fe47246e49d6ea","src/a.ts":"absent"}');
  const role: Role = m[0]?.role ?? "system";
  expect(role, "literal union").toBe("user");
});

test("Compile Card example 2: patch, src/x.ts exists with 3 lines", () => {
  const r = okOf(compileCard(card("patchP"), ROOT));
  const m = r.requests[0]?.messages ?? [];
  expect(heads(m), "original first, then the slice, then the instruction").toBe(
    "user:Original file src/x.ts: | user:Contents of file docs/A.md: | user:Patch src/x.ts.");
  expect(m[0]?.content, "the first message is 'Original file src/x.ts:' with those 3 lines fenced").toBe(X_TS);
  expect(`${r.requests.length} ${r.requests[0]?.customId}`, "variants 1").toBe("1 p.v1");
  expect(JSON.stringify(r.inputs), "inputs").toBe('{"docs/A.md":"5ab70d8e40bc35ca","src/x.ts":"73ab5a7f1128f2bb"}');
});

test("Compile Card example 3: a slice naming docs/missing.md", () => {
  const f = faultsOf(compileCard(card("missingSlice"), ROOT));
  expect(f.map((x) => `${x.key}: ${x.message}`).join(" | "), "one fault naming the path")
    .toBe("contextSlice: contextSlice 'docs/missing.md' does not exist");
});

test("Compile Card §2.2: new file under patch, model fields, faults at once, no-extension tag, empty file", () => {
  const n = okOf(compileCard(card("patchNew"), ROOT));
  const m = n.requests[0]?.messages ?? [];
  expect(heads(m), "targets in array order").toBe(
    "user:Original file src/x.ts: | user:Target src/z.ts is a new file: it does not exist yet. | user:Patch src/x.ts and add src/z.ts.");
  expect(m[1]?.content, "the new file line exactly").toBe("Target src/z.ts is a new file: it does not exist yet.");
  expect(m[2]?.content.endsWith("The targets, in this order: src/x.ts, src/z.ts."), "several-targets directive").toBe(true);
  expect(JSON.stringify(n.inputs), "inputs").toBe('{"src/x.ts":"73ab5a7f1128f2bb","src/z.ts":"absent"}');
  const g = okOf(compileCard(card("generateA", { model: "m", maxTokens: 7, reasoning: { effort: "low" }, variants: 3 }), ROOT));
  expect(`${g.requests.length} ${g.requests[2]?.customId} ${g.requests[2]?.model} ${g.requests[2]?.maxTokens} ${JSON.stringify(g.requests[2]?.reasoning)}`,
    "three variants with the card's fields").toBe('3 a.v3 m 7 {"effort":"low"}');
  const r = tmpRoot();
  try {
    r.write("docs/dir/keep", "k");
    r.write("Makefile", "all:\n");
    r.write("empty.ts", "");
    r.write("noeol.md", "x");
    const bad = faultsOf(compileCard(card("generateA", { contextSlice: ["zz.md", "docs/dir", "aa.md"] }), r.root));
    expect(bad.map((x) => x.message).join(" | "), "all faults at once, sorted").toBe(
      "contextSlice 'aa.md' does not exist | contextSlice 'docs/dir' is not a file | contextSlice 'zz.md' does not exist");
    const ok = okOf(compileCard(card("generateA", { contextSlice: ["noeol.md", "empty.ts", "Makefile"] }), r.root));
    const c = ok.requests[0]?.messages ?? [];
    expect(c[0]?.content, "no extension: no tag").toBe("Contents of file Makefile:\n```\nall:\n```");
    expect(c[1]?.content, "empty file").toBe("Contents of file empty.ts:\n```ts\n```");
    expect(c[2]?.content, "a newline appended once").toBe("Contents of file noeol.md:\n```md\nx\n```");
    const gen = okOf(compileCard(card("patchP", { intent: "generate", contextSlice: [] }), r.root));
    expect(gen.requests[0]?.messages.length, "generate shows no target, slice [] gives the instruction only").toBe(1);
  } finally {
    r.rm();
  }
});
