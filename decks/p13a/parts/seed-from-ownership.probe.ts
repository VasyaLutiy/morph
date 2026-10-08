// P13a probe for seed-from-ownership by docs/TASK_P13a_scout.md §2.2 (Seed From Ownership) — the head of git's ownership
// (P12b's Read Ownership, most recently written first): code files of any language profile, not tests, still in the tree,
// up to a limit, one note per file with its newest SEED_WRITES writes; and the round-zero text under a char cap.
// Record Seed From Ownership examples 1-3, then the §2.2 rows.
import { test, expect } from "vitest";
import { SEED_CHARS, SEED_FILES, SEED_HEADER, SEED_WRITES, renderSeed, seedFromOwnership } from "../../src/scout/seedFromOwnership.js";
import type { ScoutSeed, SeedOwnership } from "../../src/scout/seedFromOwnership.js";
import { readOwnership } from "../../src/git/ownership.js";

const w = (card: string, model: string, run: string | null): { card: string; model: string; run: string | null } => ({ card, model, run });
const OWN: SeedOwnership = {
  paths: [
    { path: "tests/q.test.ts", writes: [w("q-judge", "m/r", null)] },
    { path: "src/q.ts", writes: [w("q", "m/q", "20261110-101010"), w("q1", "m/q", "R1"), w("q0", "", null), w("qq", "m/x", "R0")] },
    { path: "docs/n.md", writes: [w("d", "m/d", null)] },
    { path: "src/gone.ts", writes: [w("g", "m/g", null)] },
    { path: "tools/x.py", writes: [w("x", "m/p", "R2")] },
    { path: "src/p.spec.ts", writes: [w("p", "m/p", null)] },
    { path: "lib/c.ts", writes: [w("c", "m/c", null)] },
    { path: "web/app.tsx", writes: [w("w", "m/w", "R3")] },
  ],
};
const FILES = ["web/app.tsx", "lib/c.ts", "src/p.spec.ts", "tools/x.py", "docs/n.md", "src/q.ts", "tests/q.test.ts"];
const N1 = "src/q.ts: written by q (m/q, run 20261110-101010); q1 (m/q, run R1); q0 (—, run —); … 1 more";
const N2 = "tools/x.py: written by x (m/p, run R2)";
const N3 = "lib/c.ts: written by c (m/c, run —)";
const N4 = "web/app.tsx: written by w (m/w, run R3)";

test("Seed From Ownership example 1: limit 3 — tests, docs, a file gone from the tree and a spec file skipped", () => {
  const want: ScoutSeed = { source: "primer", files: ["src/q.ts", "tools/x.py", "lib/c.ts"], notes: [N1, N2, N3] };
  expect(seedFromOwnership(OWN, FILES, 3)).toStrictEqual(want);
});

test("Seed From Ownership example 2: limit 10, limit 0, no ownership", () => {
  expect(seedFromOwnership(OWN, FILES, 10)).toStrictEqual(
    { source: "primer", files: ["src/q.ts", "tools/x.py", "lib/c.ts", "web/app.tsx"], notes: [N1, N2, N3, N4] });
  expect(seedFromOwnership(OWN, FILES, 0)).toStrictEqual({ source: "primer", files: [], notes: [] });
  expect(seedFromOwnership({ paths: [] }, FILES, 6)).toStrictEqual({ source: "primer", files: [], notes: [] });
});

test("Seed From Ownership example 3: renderSeed whole, cut after the first note, cut before any note, empty", () => {
  const seed = seedFromOwnership(OWN, FILES, 3);
  expect(renderSeed(seed, 8000)).toBe(`${SEED_HEADER}\n- ${N1}\n- ${N2}\n- ${N3}\n`);
  const one = SEED_HEADER.length + 1 + N1.length + 3;
  expect(renderSeed(seed, one)).toBe(`${SEED_HEADER}\n- ${N1}\n- … 2 more seeded files not shown\n`);
  expect(renderSeed(seed, 10)).toBe(`${SEED_HEADER}\n- … 3 more seeded files not shown\n`);
  expect(renderSeed({ source: "primer", files: [], notes: [] }, 8000)).toBe("");
});

test("§2.2 rows: the constants; git's Ownership passes as it is; a cut leaving one note; the cap counted with every newline", () => {
  expect([SEED_FILES, SEED_CHARS, SEED_WRITES]).toStrictEqual([6, 8000, 3]);
  expect(SEED_HEADER).toBe("Seed: code the project's cards wrote, most recently written first (git Morph-Card trailers):");
  const own = readOwnership([
    { card: "k", model: "m/k", run: null, paths: ["src/k.ts", "src/test/u.ts"] },
    { card: "j", model: "m/j", run: "R", paths: ["src/k.ts", "README.md", "src/j.pyi"] },
  ]);
  const seed = seedFromOwnership(own, ["src/k.ts", "src/j.pyi", "src/test/u.ts", "README.md"], 6);
  expect(seed).toStrictEqual({ source: "primer", files: ["src/k.ts", "src/j.pyi"],
    notes: ["src/k.ts: written by k (m/k, run —); j (m/j, run R)", "src/j.pyi: written by j (m/j, run R)"] });
  const full = renderSeed(seed, 100000);
  expect(renderSeed(seed, full.length)).toBe(full);
  expect(renderSeed(seed, full.length - 1)).toBe(`${SEED_HEADER}\n- ${seed.notes[0]}\n- … 1 more seeded file not shown\n`);
  const three = { paths: [{ path: "a.ts", writes: [w("a", "m", "1"), w("b", "m", "2"), w("c", "", "3")] }] };
  expect(seedFromOwnership(three, ["a.ts"], 1).notes).toStrictEqual(["a.ts: written by a (m, run 1); b (m, run 2); c (—, run 3)"]);
});
