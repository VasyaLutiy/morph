// P25 probe for load-config by docs/TASK_P25_config.md §2.2 (src/cli/projectConfig.ts) — issue #18 item 1:
// morph.config.yaml validated, merged over the built-in defaults, read from the root only. Record Load Config examples 1–4.
import fs from "node:fs";
import { test, expect } from "vitest";
import { tmpRoot } from "../../tests/helpers.js";
import { DEFAULT_CONFIG, loadConfig, readProjectConfig, validateConfig } from "../../src/cli/projectConfig.js";
import { DEFAULT_BUDGETS } from "../../src/scout/spendBudget.js";
import { DEFAULT_TOOL_CAPS } from "../../src/scout/runTool.js";
import { SEED_CHARS, SEED_FILES } from "../../src/scout/seedFromOwnership.js";

const DEFAULTS = {
  version: 1,
  scout: {
    grepSkip: [".morph", "decks"],
    budgets: { calls: 30, reads: 12, chars: 120000, rounds: 40, deadlineSeconds: 1800 },
    caps: { readLines: 400, readChars: 12000, grepHits: 200, grepLineChars: 300, listEntries: 300 },
    seed: { files: 6, chars: 8000 },
  },
};

test("Load Config example 1: no text, a blank text, version 1 and {} give the built-in values", () => {
  expect(DEFAULT_CONFIG).toStrictEqual(DEFAULTS);
  expect(DEFAULT_CONFIG.scout).toStrictEqual({
    grepSkip: DEFAULT_TOOL_CAPS.grepSkip,
    budgets: { calls: DEFAULT_BUDGETS.calls, reads: DEFAULT_BUDGETS.reads, chars: DEFAULT_BUDGETS.chars,
      rounds: DEFAULT_BUDGETS.rounds, deadlineSeconds: DEFAULT_BUDGETS.deadlineMs / 1000 },
    caps: { readLines: DEFAULT_TOOL_CAPS.readLines, readChars: DEFAULT_TOOL_CAPS.readChars, grepHits: DEFAULT_TOOL_CAPS.grepHits,
      grepLineChars: DEFAULT_TOOL_CAPS.grepLineChars, listEntries: DEFAULT_TOOL_CAPS.listEntries },
    seed: { files: SEED_FILES, chars: SEED_CHARS },
  });
  for (const r of [loadConfig(null), loadConfig("  \n"), loadConfig("version: 1\n"), validateConfig({})]) {
    expect(r).toStrictEqual({ ok: true, config: DEFAULTS });
  }
});

test("Load Config example 2: a given key replaces its default, the rest stays, keys in the default order", () => {
  const r = loadConfig("scout:\n  seed: {files: 3}\n  budgets: {deadlineSeconds: 600, calls: 10}\n  grepSkip: [.morph/, decks/, docs/TASK_]\n");
  const want = {
    version: 1,
    scout: {
      grepSkip: [".morph/", "decks/", "docs/TASK_"],
      budgets: { calls: 10, reads: 12, chars: 120000, rounds: 40, deadlineSeconds: 600 },
      caps: DEFAULTS.scout.caps,
      seed: { files: 3, chars: 8000 },
    },
  };
  expect(r).toStrictEqual({ ok: true, config: want });
  expect(JSON.stringify(r)).toBe(JSON.stringify({ ok: true, config: want }));
});

test("Load Config example 3: every problem, unknown keys first, then the table order", () => {
  const text = "version: 2\nscuot: 1\nscout:\n  caps: []\n  budgets: {calls: \"30\", reads: 0, call: 1}\n  grepSkip: [\"\", 3]\n";
  expect(loadConfig(text)).toStrictEqual({ ok: false, problems: [
    "(root): unknown key 'scuot' (known: version, scout)",
    "version: must be 1",
    "scout.grepSkip[0]: must be a non-empty string",
    "scout.grepSkip[1]: must be a non-empty string",
    "scout.budgets: unknown key 'call' (known: calls, reads, chars, rounds, deadlineSeconds)",
    "scout.budgets.calls: must be a positive integer",
    "scout.budgets.reads: must be a positive integer",
    "scout.caps: must be an object",
  ] });
  expect(validateConfig([])).toStrictEqual({ ok: false, problems: ["(root): config must be an object"] });
  expect(validateConfig({ scout: null })).toStrictEqual({ ok: false, problems: ["scout: must be an object"] });
  expect(validateConfig({ scout: { grepSkip: "decks", seed: { chars: 1.5 } } })).toStrictEqual({ ok: false,
    problems: ["scout.grepSkip: must be a list", "scout.seed.chars: must be a positive integer"] });
  const bad = loadConfig("a: [\n");
  expect(bad.ok).toBe(false);
  if (!bad.ok) {
    expect(bad.problems.length).toBe(1);
    expect(bad.problems[0]!.startsWith("cannot parse morph.config.yaml: ")).toBe(true);
  }
  expect(loadConfig("- 1\n")).toStrictEqual({ ok: false, problems: ["morph.config.yaml is not a mapping at the top level"] });
});

test("Load Config example 4: the file at the root only; problems as a DeckError result", () => {
  const r = tmpRoot("morph-p25cfg-");
  try {
    expect(readProjectConfig(r.root)).toStrictEqual({ ok: true, config: DEFAULTS });
    r.write("morph.config.yaml", "scout:\n  grepSkip: [docs/TASK_]\n");
    expect(readProjectConfig(r.root)).toStrictEqual({ ok: true,
      config: { version: 1, scout: { ...DEFAULTS.scout, grepSkip: ["docs/TASK_"] } } });
    r.write("morph.config.yaml", "scout: {budgets: {calls: x}, cap: 1}\n");
    expect(readProjectConfig(r.root)).toStrictEqual({ ok: false, result: { code: 2, document: { error: { code: 2, kind: "DeckError",
      message: "morph.config.yaml is not a valid config (2 problems): scout: unknown key 'cap' (known: grepSkip, budgets, caps, seed); scout.budgets.calls: must be a positive integer" } } } });
    fs.mkdirSync(r.path("sub/morph.config.yaml"), { recursive: true });
    expect(readProjectConfig(r.path("sub"))).toStrictEqual({ ok: true, config: DEFAULTS });
  } finally { r.rm(); }
});
