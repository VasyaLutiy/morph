/**
 * Parse Turn — one model turn of the scout protocol read as one action, one
 * final answer or a malformed turn with its reason. Pure: imports nothing,
 * touches no clock, no environment, no file system.
 */

export type ScoutAction =
  | { kind: "read"; path: string; from: number | null; to: number | null }
  | { kind: "grep"; pattern: string; path: string }
  | { kind: "list"; path: string };

export interface ScoutAnswer {
  targets: string[];
  context_slice: string[];
  reasoning: string;
}

export type Turn =
  | { kind: "action"; action: ScoutAction; skipped?: string[] }
  | { kind: "answer"; answer: ScoutAnswer }
  | { kind: "malformed"; reason: string };

export const VERBS: readonly string[] = ["READ", "GREP", "LIST", "ANSWER"];

const ACTION_LINE = /^(READ|GREP|LIST|ANSWER)(?=\s|$)/;
const READ_RANGE = /^(.*\S)\s+(\d+)-(\d+)$/;

function malformed(reason: string): Turn {
  return { kind: "malformed", reason };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPathList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function parseAnswer(rest: string): Turn {
  const a = rest.indexOf("{");
  const b = rest.lastIndexOf("}");
  if (a < 0 || b < a) {
    return malformed("ANSWER: no JSON object");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rest.slice(a, b + 1)) as unknown;
  } catch {
    return malformed("ANSWER: the JSON does not parse");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return malformed("ANSWER: targets must be a non-empty list of paths");
  }
  const obj = parsed as Record<string, unknown>;

  const rawTargets = obj["targets"];
  if (!isPathList(rawTargets) || rawTargets.length < 1) {
    return malformed("ANSWER: targets must be a non-empty list of paths");
  }

  const rawSlice = obj["context_slice"];
  let context_slice: string[];
  if (rawSlice === undefined) {
    context_slice = [];
  } else if (isPathList(rawSlice)) {
    context_slice = rawSlice;
  } else {
    return malformed("ANSWER: context_slice must be a list of paths");
  }

  const rawReasoning = obj["reasoning"];
  let reasoning: string;
  if (rawReasoning === undefined) {
    reasoning = "";
  } else if (typeof rawReasoning === "string") {
    reasoning = rawReasoning;
  } else {
    return malformed("ANSWER: reasoning must be a string");
  }

  return {
    kind: "answer",
    answer: { targets: rawTargets, context_slice, reasoning },
  };
}

export function parseTurn(text: string | null): Turn {
  if (text === null || text.trim() === "") {
    return malformed("empty turn");
  }

  const lines = text
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));

  const found: { verb: string; index: number; line: string }[] = [];
  lines.forEach((raw, index) => {
    const match = ACTION_LINE.exec(raw.trimStart());
    if (match !== null) {
      found.push({ verb: match[1], index, line: raw });
    }
  });

  if (found.length === 0) {
    return malformed(
      "no action: one line must start with READ, GREP, LIST or ANSWER",
    );
  }
  if (found.length > 1) {
    const verbs = found.map((entry) => entry.verb).join(", ");
    return malformed(
      `${found.length} actions in one turn (${verbs}): send one per turn`,
    );
  }

  const { verb, index, line } = found[0];

  if (verb === "ANSWER") {
    const rest = [
      line.trimStart().slice(verb.length),
      ...lines.slice(index + 1),
    ].join("\n");
    return parseAnswer(rest);
  }

  const args = line.trim().slice(verb.length).trim();

  if (verb === "READ") {
    if (args === "") {
      return malformed("READ needs a path");
    }
    const range = READ_RANGE.exec(args);
    if (range !== null) {
      const path = range[1];
      const from = Number(range[2]);
      const to = Number(range[3]);
      if (from < 1 || to < from) {
        return malformed(`READ: bad line range ${from}-${to}`);
      }
      return { kind: "action", action: { kind: "read", path, from, to } };
    }
    return {
      kind: "action",
      action: { kind: "read", path: args, from: null, to: null },
    };
  }

  if (verb === "GREP") {
    const cut = args.lastIndexOf(" -- ");
    let pattern: string;
    let path: string;
    if (cut >= 0) {
      pattern = args.slice(0, cut).trim();
      path = args.slice(cut + 4).trim();
    } else {
      pattern = args;
      path = "";
    }
    if (pattern === "") {
      return malformed("GREP needs a pattern");
    }
    try {
      new RegExp(pattern);
    } catch {
      return malformed(`GREP: invalid pattern /${pattern}/`);
    }
    return { kind: "action", action: { kind: "grep", pattern, path } };
  }

  return { kind: "action", action: { kind: "list", path: args } };
}
