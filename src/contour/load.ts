import { parse } from "yaml";
import { validateRecord } from "./record.js";
import { validateMap } from "./map.js";
import type { DocResult, LoadMapResult, LoadRecordResult } from "./types.js";

export const MAX_LISTED_PROBLEMS = 20;

function firstLine(message: string): string {
  const i = message.indexOf("\n");
  return i === -1 ? message : message.slice(0, i);
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return firstLine(e.message);
  return firstLine(String(e));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseDocument(text: string, name: string): DocResult {
  const lower = name.toLowerCase();
  let doc: unknown;
  try {
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
      doc = parse(text);
    } else {
      doc = JSON.parse(text);
    }
  } catch (e) {
    return { ok: false, error: "cannot parse " + name + ": " + errorMessage(e) };
  }
  if (!isPlainObject(doc)) {
    return { ok: false, error: name + " is not a mapping at the top level" };
  }
  return { ok: true, doc };
}

function invalidMessage(name: string, kind: string, problems: string[]): string {
  const n = problems.length;
  const lines = problems.slice(0, MAX_LISTED_PROBLEMS).join("\n");
  let error = name + " is not a valid " + kind + " (" + n + " problem" + (n === 1 ? "" : "s") + "):\n" + lines;
  if (n > MAX_LISTED_PROBLEMS) {
    error += "\n… and " + (n - MAX_LISTED_PROBLEMS) + " more";
  }
  return error;
}

export function loadContour(text: string, name: string): LoadRecordResult {
  const parsed = parseDocument(text, name);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const result = validateRecord(parsed.doc);
  if (!result.ok) {
    return { ok: false, error: invalidMessage(name, "record", result.problems) };
  }
  return { ok: true, record: result.record };
}

export function loadMap(text: string, name: string): LoadMapResult {
  const parsed = parseDocument(text, name);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const result = validateMap(parsed.doc);
  if (!result.ok) {
    return { ok: false, error: invalidMessage(name, "map", result.problems) };
  }
  return { ok: true, map: result.map };
}
