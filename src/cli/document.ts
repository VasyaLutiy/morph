import fs from "node:fs";
import path from "node:path";
import { loadDeck } from "../cards/model.js";
import type { RunReport } from "../runloop/types.js";
import type { ArchiveResult } from "../git/types.js";
import type {
  DeckFileResult,
  ErrorDocument,
  ErrorKind,
  ExitCode,
  CommandResult,
} from "./types.js";

export function renderDocument(doc: unknown, pretty: boolean): string {
  return JSON.stringify(doc, null, pretty ? 2 : undefined) + "\n";
}

export function errorDocument(code: ExitCode, kind: ErrorKind, message: string): ErrorDocument {
  return { error: { code, kind, message } };
}

export function classifyThrown(e: unknown): CommandResult {
  return {
    code: 3,
    document: errorDocument(3, "RuntimeError", e instanceof Error ? e.message : String(e)),
  };
}

export function runExitCode(report: RunReport, archive: ArchiveResult): ExitCode {
  if (!archive.ok) return 3;
  for (const outcome of report.outcomes) {
    if (outcome.status !== "written") return 1;
  }
  return 0;
}

export function readDeckFile(root: string, deckPath: string): DeckFileResult {
  const abs = path.resolve(root, deckPath);
  let isFile = false;
  try {
    isFile = fs.statSync(abs).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    return {
      ok: false,
      result: {
        code: 4,
        document: errorDocument(4, "UsageError", "deck file not found: " + deckPath),
      },
    };
  }
  const loaded = loadDeck(fs.readFileSync(abs, "utf8"));
  if (!loaded.ok) {
    return {
      ok: false,
      result: {
        code: 2,
        document: errorDocument(
          2,
          "DeckError",
          "invalid deck: " + loaded.faults.map((f) => f.key + ": " + f.message).join("; "),
        ),
      },
    };
  }
  return { ok: true, deck: loaded.deck };
}
