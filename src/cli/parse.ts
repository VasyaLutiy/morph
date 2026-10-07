import { errorDocument } from "./document.js";
import type { Command, ParseResult } from "./types.js";

const VALUE_FLAGS: ReadonlySet<string> = new Set([
  "--root",
  "--deck",
  "--processor",
  "--run-id",
  "--deadline",
  "--max-cards",
  "--max-retry-batches",
  "--slice-cap-bytes",
  "--spec",
  "--component",
  "--map",
  "--out",
  "--checks",
]);

const NOT_YET_WORDS: ReadonlySet<string> = new Set([
  "plan",
  "scout",
  "primer",
  "review",
  "report",
]);

const NOT_YET_DECK_WORDS: ReadonlySet<string> = new Set([
  "add",
  "status",
  "reset",
  "clear",
]);

const DECK_CHECK_FLAGS: ReadonlySet<string> = new Set([
  "--root",
  "--pretty",
  "--deck",
  "--slice-cap-bytes",
]);

const RUN_FLAGS: ReadonlySet<string> = new Set([
  "--root",
  "--pretty",
  "--deck",
  "--processor",
  "--run-id",
  "--deadline",
  "--max-cards",
  "--max-retry-batches",
]);

const PLAN_FLAGS: ReadonlySet<string> = new Set([
  "--root",
  "--pretty",
  "--spec",
  "--component",
  "--map",
  "--judge",
  "--out",
  "--checks",
]);

function isPositiveInteger(v: string): boolean {
  return /^[0-9]+$/.test(v) && Number(v) >= 1;
}

function isNonNegativeInteger(v: string): boolean {
  return /^[0-9]+$/.test(v) && Number(v) >= 0;
}

export function parseCommand(argv: string[]): ParseResult {
  // Check 1: scan argv left to right.
  const words: string[] = [];
  const order: string[] = [];
  const values = new Map<string, string>();
  const components: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      if (!VALUE_FLAGS.has(t) && t !== "--pretty" && t !== "--judge") {
        return { ok: false, error: errorDocument(4, "UsageError", "unknown flag: " + t) };
      }
      if (t !== "--component" && seen.has(t)) {
        return { ok: false, error: errorDocument(4, "UsageError", "flag " + t + " given twice") };
      }
      seen.add(t);
      order.push(t);
      if (VALUE_FLAGS.has(t)) {
        if (i + 1 >= argv.length) {
          return { ok: false, error: errorDocument(4, "UsageError", "flag " + t + " needs a value") };
        }
        i++;
        if (t === "--component") {
          components.push(argv[i]);
        } else {
          values.set(t, argv[i]);
        }
      }
    } else {
      words.push(t);
    }
  }

  // Check 2: the command from the words.
  let name: "deck check" | "run" | "plan";
  let arity: number;
  if (words.length === 0) {
    return {
      ok: false,
      error: errorDocument(4, "UsageError", "no command (commands: deck check, plan, run)"),
    };
  }
  const first = words[0];
  if (first === "run") {
    name = "run";
    arity = 1;
  } else if (first === "plan") {
    name = "plan";
    arity = 1;
  } else if (first === "deck") {
    if (words.length >= 2 && words[1] === "check") {
      name = "deck check";
      arity = 2;
    } else if (words.length >= 2 && NOT_YET_DECK_WORDS.has(words[1])) {
      return {
        ok: false,
        error: errorDocument(
          4,
          "NotYetError",
          "command deck " + words[1] + " is not available yet",
        ),
      };
    } else {
      return {
        ok: false,
        error: errorDocument(4, "UsageError", "unknown command: " + words.join(" ")),
      };
    }
  } else if (NOT_YET_WORDS.has(first)) {
    return {
      ok: false,
      error: errorDocument(4, "NotYetError", "command " + first + " is not available yet"),
    };
  } else {
    return {
      ok: false,
      error: errorDocument(4, "UsageError", "unknown command: " + words.join(" ")),
    };
  }

  // Check 3: extra words.
  if (words.length > arity) {
    return {
      ok: false,
      error: errorDocument(4, "UsageError", "unexpected argument: " + words[arity]),
    };
  }

  // Check 4: a flag the command does not take, in argv order.
  const allowed = name === "deck check" ? DECK_CHECK_FLAGS : name === "run" ? RUN_FLAGS : PLAN_FLAGS;
  for (const f of order) {
    if (!allowed.has(f)) {
      return {
        ok: false,
        error: errorDocument(4, "UsageError", "flag " + f + " does not apply to " + name),
      };
    }
  }

  // Check 5: plan needs --spec.
  if (name === "plan") {
    if (!values.has("--spec")) {
      return { ok: false, error: errorDocument(4, "UsageError", "missing --spec") };
    }
    const root = values.get("--root") ?? ".";
    const command: Command = {
      name: "plan",
      root,
      pretty: seen.has("--pretty"),
      spec: values.get("--spec") ?? "",
      components,
      map: values.get("--map") ?? null,
      judge: seen.has("--judge"),
      out: values.get("--out") ?? null,
      ...(values.has("--checks") ? { checks: values.get("--checks") ?? "" } : {}),
    };
    return { ok: true, command };
  }

  // Check 6: missing --deck.
  if (!values.has("--deck")) {
    return { ok: false, error: errorDocument(4, "UsageError", "missing --deck") };
  }

  // Check 7: run without --processor.
  if (name === "run" && !values.has("--processor")) {
    return { ok: false, error: errorDocument(4, "UsageError", "missing --processor") };
  }

  // Check 8: the value validations, in the fixed order.
  const deck = values.get("--deck") ?? "";
  const root = values.get("--root") ?? ".";
  const pretty = seen.has("--pretty");
  if (name === "deck check") {
    const cap = values.get("--slice-cap-bytes");
    if (cap !== undefined && !isPositiveInteger(cap)) {
      return {
        ok: false,
        error: errorDocument(
          4,
          "UsageError",
          "--slice-cap-bytes must be a positive integer (got '" + cap + "')",
        ),
      };
    }
    const command: Command = {
      name: "deck check",
      root,
      pretty,
      deck,
      sliceCapBytes: cap !== undefined ? Number(cap) : 500000,
    };
    return { ok: true, command };
  }
  const runIdRaw = values.get("--run-id");
  if (runIdRaw !== undefined && !/^[A-Za-z0-9._-]+$/.test(runIdRaw)) {
    return {
      ok: false,
      error: errorDocument(
        4,
        "UsageError",
        "--run-id must match ^[A-Za-z0-9._-]+$ (got '" + runIdRaw + "')",
      ),
    };
  }
  const deadline = values.get("--deadline");
  if (deadline !== undefined && !isPositiveInteger(deadline)) {
    return {
      ok: false,
      error: errorDocument(
        4,
        "UsageError",
        "--deadline must be a positive integer (got '" + deadline + "')",
      ),
    };
  }
  const maxCards = values.get("--max-cards");
  if (maxCards !== undefined && !isPositiveInteger(maxCards)) {
    return {
      ok: false,
      error: errorDocument(
        4,
        "UsageError",
        "--max-cards must be a positive integer (got '" + maxCards + "')",
      ),
    };
  }
  const maxRetryBatches = values.get("--max-retry-batches");
  if (maxRetryBatches !== undefined && !isNonNegativeInteger(maxRetryBatches)) {
    return {
      ok: false,
      error: errorDocument(
        4,
        "UsageError",
        "--max-retry-batches must be a non-negative integer (got '" + maxRetryBatches + "')",
      ),
    };
  }

  // Check 9: success, the keys in the type's order, with the defaults.
  const command: Command = {
    name: "run",
    root,
    pretty,
    deck,
    processor: values.get("--processor") ?? "",
    runId: runIdRaw !== undefined ? runIdRaw : null,
    deadlineSeconds: deadline !== undefined ? Number(deadline) : 2400,
    maxCards: maxCards !== undefined ? Number(maxCards) : null,
    maxRetryBatches: maxRetryBatches !== undefined ? Number(maxRetryBatches) : 2,
  };
  return { ok: true, command };
}
