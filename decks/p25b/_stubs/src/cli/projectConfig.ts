import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "../contour/load.js";
import { errorDocument } from "./document.js";
import { DEFAULT_SCOUT_SETTINGS } from "../scout/scoutCommand.js";
import type { ScoutSettings } from "../scout/scoutCommand.js";
import type { CommandResult } from "./types.js";

export const CONFIG_FILE = "morph.config.yaml";

export type ProjectConfig = {
  version: 1;
  scout: ScoutSettings;
};

export type ConfigResult =
  | { ok: true; config: ProjectConfig }
  | { ok: false; problems: string[] };

export const DEFAULT_CONFIG: ProjectConfig = {
  version: 1,
  scout: DEFAULT_SCOUT_SETTINGS,
};

type Field =
  | { name: string; kind: "version" }
  | { name: string; kind: "number" }
  | { name: string; kind: "grepSkip" }
  | { name: string; kind: "object"; fields: Field[] };

const BUDGET_FIELDS: Field[] = [
  { name: "calls", kind: "number" },
  { name: "reads", kind: "number" },
  { name: "chars", kind: "number" },
  { name: "rounds", kind: "number" },
  { name: "deadlineSeconds", kind: "number" },
];

const CAPS_FIELDS: Field[] = [
  { name: "readLines", kind: "number" },
  { name: "readChars", kind: "number" },
  { name: "grepHits", kind: "number" },
  { name: "grepLineChars", kind: "number" },
  { name: "listEntries", kind: "number" },
];

const SEED_FIELDS: Field[] = [
  { name: "files", kind: "number" },
  { name: "chars", kind: "number" },
];

const SCOUT_FIELDS: Field[] = [
  { name: "grepSkip", kind: "grepSkip" },
  { name: "budgets", kind: "object", fields: BUDGET_FIELDS },
  { name: "caps", kind: "object", fields: CAPS_FIELDS },
  { name: "seed", kind: "object", fields: SEED_FIELDS },
];

const ROOT_FIELDS: Field[] = [
  { name: "version", kind: "version" },
  { name: "scout", kind: "object", fields: SCOUT_FIELDS },
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

function validateNode(
  section: string,
  value: Record<string, unknown>,
  fields: Field[],
  problems: string[],
): void {
  const known = fields.map((f) => f.name);
  const knownSet = new Set(known);
  const label = section === "" ? "(root)" : section;
  for (const key of Object.keys(value)) {
    if (!knownSet.has(key)) {
      problems.push(label + ": unknown key '" + key + "' (known: " + known.join(", ") + ")");
    }
  }
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(value, field.name)) continue;
    const child = value[field.name];
    const childPath = section === "" ? field.name : section + "." + field.name;
    switch (field.kind) {
      case "version":
        if (child !== 1) problems.push(childPath + ": must be 1");
        break;
      case "number":
        if (!isPositiveInteger(child)) problems.push(childPath + ": must be a positive integer");
        break;
      case "grepSkip":
        if (!Array.isArray(child)) {
          problems.push(childPath + ": must be a list");
        } else {
          const list: unknown[] = child;
          for (let j = 0; j < list.length; j++) {
            const entry = list[j];
            if (typeof entry !== "string" || entry.length === 0) {
              problems.push(childPath + "[" + j + "]: must be a non-empty string");
            }
          }
        }
        break;
      case "object":
        if (!isPlainObject(child)) {
          problems.push(childPath + ": must be an object");
        } else {
          validateNode(childPath, child, field.fields, problems);
        }
        break;
    }
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function buildConfig(doc: Record<string, unknown>): ProjectConfig {
  const defaults = DEFAULT_SCOUT_SETTINGS;
  const scout = isPlainObject(doc.scout) ? doc.scout : {};
  const budgetsRaw = scout.budgets;
  const budgets = isPlainObject(budgetsRaw) ? budgetsRaw : {};
  const capsRaw = scout.caps;
  const caps = isPlainObject(capsRaw) ? capsRaw : {};
  const seedRaw = scout.seed;
  const seed = isPlainObject(seedRaw) ? seedRaw : {};
  const grepSkip = Array.isArray(scout.grepSkip)
    ? (scout.grepSkip as string[]).slice()
    : defaults.grepSkip.slice();
  return {
    version: 1,
    scout: {
      grepSkip,
      budgets: {
        calls: numberOr(budgets.calls, defaults.budgets.calls),
        reads: numberOr(budgets.reads, defaults.budgets.reads),
        chars: numberOr(budgets.chars, defaults.budgets.chars),
        rounds: numberOr(budgets.rounds, defaults.budgets.rounds),
        deadlineSeconds: numberOr(budgets.deadlineSeconds, defaults.budgets.deadlineSeconds),
      },
      caps: {
        readLines: numberOr(caps.readLines, defaults.caps.readLines),
        readChars: numberOr(caps.readChars, defaults.caps.readChars),
        grepHits: numberOr(caps.grepHits, defaults.caps.grepHits),
        grepLineChars: numberOr(caps.grepLineChars, defaults.caps.grepLineChars),
        listEntries: numberOr(caps.listEntries, defaults.caps.listEntries),
      },
      seed: {
        files: numberOr(seed.files, defaults.seed.files),
        chars: numberOr(seed.chars, defaults.seed.chars),
      },
    },
  };
}

export function validateConfig(doc: unknown): ConfigResult {
  if (!isPlainObject(doc)) {
    return { ok: false, problems: ["(root): config must be an object"] };
  }
  const problems: string[] = [];
  validateNode("", doc, ROOT_FIELDS, problems);
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  return { ok: true, config: buildConfig(doc) };
}

export function loadConfig(text: string | null, name: string = CONFIG_FILE): ConfigResult {
  if (text === null || text.trim().length === 0) {
    return { ok: true, config: buildConfig({}) };
  }
  const parsed = parseDocument(text, name);
  if (!parsed.ok) {
    return { ok: false, problems: [parsed.error] };
  }
  return validateConfig(parsed.doc);
}

export function readProjectConfig(
  root: string,
): { ok: true; config: ProjectConfig } | { ok: false; result: CommandResult } {
  const file = path.join(root, CONFIG_FILE);
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  const text = stat?.isFile() ? fs.readFileSync(file, "utf8") : null;
  const loaded = loadConfig(text);
  if (loaded.ok) {
    return { ok: true, config: loaded.config };
  }
  const n = loaded.problems.length;
  const message =
    CONFIG_FILE +
    " is not a valid config (" +
    n +
    " problem" +
    (n === 1 ? "" : "s") +
    "): " +
    loaded.problems.join("; ");
  return {
    ok: false,
    result: { code: 2, document: errorDocument(2, "DeckError", message) },
  };
}
