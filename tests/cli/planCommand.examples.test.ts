import { expect, test } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { main } from "../../src/cli/main.js";
import { readDeckFile } from "../../src/cli/document.js";
import { fixture, fixtureJson, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";
import type { Plan } from "../../src/planner/types.js";
import type { CliDeps, CliIo, ExitCode, PlanArgs, PlanDocument } from "../../src/cli/types.js";

function planRoot(): TmpRoot {
  const r = tmpRoot();
  r.write("ledger.yaml", fixture("planner/ledger.yaml"));
  r.write("ledger.map.json", fixture("planner/ledger.map.json"));
  r.write("tests/helpers.ts", "export {};\n");
  return r;
}

function planArgs(root: string, over: Partial<Omit<PlanArgs, "name">>): PlanArgs {
  return {
    name: "plan",
    root: "",
    pretty: false,
    spec: "ledger.yaml",
    components: ["ledger", "store"],
    map: "ledger.map.json",
    judge: true,
    out: "decks/p.json",
    ...over,
  };
}

test("Plan Command example 1: the ledger record with a map plans into decks/p.json", () => {
  const r = planRoot();
  try {
    const result = planCommand(r.root, planArgs(r.root, {}));
    const expected: PlanDocument = {
      ...(fixtureJson("planner/ledger.plan.json") as Plan),
      out: "decks/p.json",
    };
    expect(result).toStrictEqual({ code: 0, document: expected });
    const text = JSON.stringify(expected.cards, null, 2) + "\n";
    expect(r.read("decks/p.json")).toBe(text);
    const deck = readDeckFile(r.root, "decks/p.json");
    expect(deck.ok).toBe(true);
    if (deck.ok) {
      expect(deck.deck.cards.length).toBe(17);
      expect(deck.deck.externalDependsOn).toStrictEqual(["outside"]);
    }
  } finally {
    r.rm();
  }
});

test("Plan Command example 2: a missing spec or map file answers exit 4", () => {
  const r = planRoot();
  try {
    const specMissing = planCommand(r.root, planArgs(r.root, { spec: "nope.yaml", map: null }));
    expect(specMissing).toStrictEqual({
      code: 4,
      document: { error: { code: 4, kind: "UsageError", message: "spec file not found: nope.yaml" } },
    });
    const mapMissing = planCommand(r.root, planArgs(r.root, { map: "m.json" }));
    expect(mapMissing).toStrictEqual({
      code: 4,
      document: { error: { code: 4, kind: "UsageError", message: "map file not found: m.json" } },
    });
  } finally {
    r.rm();
  }
});

test("Plan Command example 3: an invalid record or map answers exit 2 with its problems", () => {
  const r = planRoot();
  try {
    r.write("bad.yaml", "System: {}\n");
    const badRecord = planCommand(r.root, planArgs(r.root, { spec: "bad.yaml", map: null }));
    expect(badRecord).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "DeckError",
          message:
            "bad.yaml is not a valid record (3 problems):\nSystem.name: required\nSystem.description: required\nSystem.groups: required",
        },
      },
    });
    r.write("m.json", "{\"docs\": \"x\"}");
    const badMap = planCommand(r.root, planArgs(r.root, { map: "m.json" }));
    expect(badMap).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "DeckError",
          message: "m.json is not a valid map (1 problem):\ndocs: must be a list",
        },
      },
    });
  } finally {
    r.rm();
  }
});

test("Plan Command example 4: an unknown Component answers exit 2 and writes nothing", () => {
  const r = planRoot();
  try {
    const result = planCommand(r.root, planArgs(r.root, { components: ["nope"], out: "decks/q.json" }));
    expect(result).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "DeckError",
          message: "no Component 'nope' in the record (have: ledger, store)",
        },
      },
    });
    expect(r.exists("decks/q.json")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Plan Command example 5: main dispatches a plan argv and writes nothing without --out", async () => {
  const r = planRoot();
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = {
    stdout: (t: string) => {
      out.push(t);
    },
    stderr: (t: string) => {
      err.push(t);
    },
  };
  const deps: CliDeps = { env: {}, now: () => 0, cwd: "/", transport: null };
  try {
    const before = JSON.stringify(r.exists("decks") ? r.read("decks/p.json") : null);
    const code: ExitCode = await main(
      [
        "plan",
        "--root",
        r.root,
        "--spec",
        "ledger.yaml",
        "--component",
        "store",
        "--map",
        "ledger.map.json",
      ],
      deps,
      io,
    );
    expect(code).toBe(0);
    expect(out.length).toBe(1);
    const doc = JSON.parse(out[0]) as PlanDocument;
    expect(doc.components).toStrictEqual(["store"]);
    expect(doc.cards.length).toBe(4);
    expect(doc.out).toBe(null);
    expect(err).toStrictEqual(["morph plan: exit 0\n"]);
    const after = JSON.stringify(r.exists("decks") ? r.read("decks/p.json") : null);
    expect(after).toBe(before);
  } finally {
    r.rm();
  }
});
