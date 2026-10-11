import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { layerGenerations } from "../../src/cards/layer.js";
import type { Deck } from "../../src/cards/types.js";
import { checkBuilds } from "../../src/cli/checkBuilds.js";
import type { BuildCheck } from "../../src/cli/checkBuilds.js";
import { readDeckFile } from "../../src/cli/document.js";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";

function copyOf(name: string): TmpRoot {
  const r = tmpRoot();
  fs.cpSync(fixturePath(name), r.root, { recursive: true });
  return r;
}

function rootOf(name: string): TmpRoot {
  const r = tmpRoot();
  for (const [p, t] of Object.entries(fixtureJson(name) as Record<string, string>)) {
    r.write(p, t);
  }
  fs.symlinkSync(path.resolve(fixturePath("."), "../../node_modules"), r.path("node_modules"));
  return r;
}

const pathEnv = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });

function scriptsRoot(): { r: TmpRoot; env: Record<string, string> } {
  const r = tmpRoot();
  r.write("d.json", fixture("planner/stub.cards.json"));
  for (const f of ["calc/a.go", "report/c.go", "src/t.ts", "tests/t.test.ts"]) {
    r.write("_stubs/" + f, "x\n");
  }
  r.write("bin/go", '#!/bin/sh\necho "vet: ./calc/zz.go:1:2: go ran with $GOFLAGS"\nexit 1\n');
  r.write(
    "node_modules/.bin/tsc",
    '#!/bin/sh\necho "src/t.ts(1,1): error TS1: own"\necho "src/zz.ts(2,3): error TS2: tsc ran with $NO_COLOR $3"\nexit 2\n',
  );
  fs.chmodSync(r.path("bin/go"), 0o755);
  fs.chmodSync(r.path("node_modules/.bin/tsc"), 0o755);
  return { r, env: { PATH: r.path("bin") + ":" + (process.env.PATH ?? "") } };
}

function load(r: TmpRoot, deckPath: string): { deck: Deck; generations: string[][] } {
  const l = readDeckFile(r.root, deckPath);
  if (!l.ok) throw new Error(deckPath);
  return { deck: l.deck, generations: layerGenerations(l.deck) };
}

const builds = (k: string): BuildCheck[] =>
  (fixtureJson("cli/checkBuilds.json") as Record<string, BuildCheck[]>)[k];

const GUARD =
  "supervisor/guard.go:20:23: l.Resumes undefined (type *Loop has no field or method Resumes)";

test(
  "Check Builds example 1: the go-p7b cuts, with and without a stub",
  () => {
    const r = copyOf("go-p7b");
    try {
      const p20Path = "decks/b1/deck.p20.json";
      const p21Path = "decks/b1/deck.p21.json";

      const p20 = load(r, p20Path);
      const got20 = checkBuilds(r.root, p20Path, p20.deck, p20.generations, pathEnv());
      expect(got20).toStrictEqual(builds("p20"));
      if (got20 === null) throw new Error(p20Path);
      expect(got20).toHaveLength(8);
      for (const c of got20) expect(c.language).toBe("go");
      const phase = got20.find((c) => c.card === "phase-loop");
      expect(phase?.generation).toBe(1);
      expect(phase?.stubbed).toBe(2);
      expect(phase?.breaks).toStrictEqual([GUARD]);
      expect(got20.filter((c) => c.breaks.length > 0)).toHaveLength(5);
      expect(got20.reduce((n, c) => n + c.breaks.length, 0)).toBe(9);

      const p21 = load(r, p21Path);
      const got21 = checkBuilds(r.root, p21Path, p21.deck, p21.generations, pathEnv());
      expect(got21).toStrictEqual(builds("p21"));
      if (got21 === null) throw new Error(p21Path);
      for (const c of got21) {
        expect(c.missing).toStrictEqual([]);
        expect(c.breaks).toStrictEqual([]);
      }

      fs.rmSync(r.path("decks/b1/_stubs/supervisor/guard.go"));
      const got21b = checkBuilds(r.root, p21Path, p21.deck, p21.generations, pathEnv());
      expect(got21b).toStrictEqual(builds("p21 without the guard.go stub"));
      if (got21b === null) throw new Error(p21Path);
      const runtimeGuard = got21b.find((c) => c.card === "runtime-guard");
      expect(runtimeGuard?.missing).toStrictEqual(["supervisor/guard.go"]);
      expect(runtimeGuard?.breaks).toStrictEqual([]);
      const later = got21b.filter((c) => c.card !== "runtime-guard" && c.breaks.includes(GUARD));
      expect(later).toHaveLength(3);
    } finally {
      r.rm();
    }
  },
  120000,
);

test(
  "Check Builds example 2: the ts-rename cut",
  () => {
    const r = rootOf("ts-rename.json");
    try {
      const deckPath = "decks/r1/deck.json";
      const l = load(r, deckPath);
      const got = checkBuilds(r.root, deckPath, l.deck, l.generations, pathEnv());
      expect(got).toStrictEqual(builds("ts-rename"));
      if (got === null) throw new Error(deckPath);
      expect(got).toHaveLength(4);
      for (const c of got) expect(c.language).toBe("typescript");
      expect(got.find((c) => c.card === "to-metres")?.breaks).toHaveLength(2);
      expect(got.find((c) => c.card === "length-line")?.breaks).toHaveLength(2);
      expect(got.find((c) => c.card === "to-metres-judge")?.breaks).toHaveLength(1);
      expect(got.find((c) => c.card === "length-line-judge")?.breaks).toStrictEqual([]);
    } finally {
      r.rm();
    }
  },
  120000,
);

test(
  "Check Builds example 3: the stub cards deck with scripted steps",
  () => {
    const { r, env } = scriptsRoot();
    try {
      const deckPath = "d.json";
      const l = load(r, deckPath);
      const got = checkBuilds(r.root, deckPath, l.deck, l.generations, env);
      expect(got).toStrictEqual(builds("cards"));
      if (got === null) throw new Error(deckPath);
      expect(got.find((c) => c.card === "a")?.breaks).toStrictEqual([
        "calc/zz.go:1:2: go ran with -mod=mod",
      ]);
      expect(got.find((c) => c.card === "n")?.note).toBe(
        "the acceptance writes no $P/full.json: not built",
      );
      expect(got.find((c) => c.card === "t")?.breaks).toStrictEqual([
        "src/zz.ts(2,3): error TS2: tsc ran with 1 probe/t/tsconfig.card.json",
      ]);
      expect(got.find((c) => c.card === "p")?.note).toBe(
        "python has no compile or typecheck step: not built",
      );
      const b = got.find((c) => c.card === "b");
      expect(b?.breaks).toStrictEqual(["calc/zz.go:1:2: go ran with -mod=vendor"]);
      expect(b?.missing).toStrictEqual(["calc/n.go", "calc/b.go", "calc/b_test.go"]);
      expect(got.find((c) => c.card === "u")?.breaks).toHaveLength(2);
      expect(got.find((c) => c.card === "j")?.missing).toHaveLength(5);
    } finally {
      r.rm();
    }
  },
  120000,
);
