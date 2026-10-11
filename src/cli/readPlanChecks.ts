import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "../contour/load.js";
import { validateChecks } from "../builder/readChecks.js";
import { probeFile } from "../builder/buildAcceptances.js";
import { TYPESCRIPT } from "../language/profiles.js";
import { errorDocument } from "./document.js";
import type { BuildTexts, Checks } from "../builder/types.js";
import type { LanguageProfile } from "../language/types.js";
import type { CommandResult } from "./types.js";

export const GUARD_PATH = "decks/tools/guard.mjs";
export const LOCATOR_PATH = "decks/tools/firstdiff.mjs";

export type PlanChecksResult =
  | { ok: true; checks: Checks; texts: BuildTexts }
  | { ok: false; result: CommandResult };

function isRegularFile(abs: string): boolean {
  try {
    return fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

export function readPlanChecks(
  root: string,
  checksPath: string,
  profile: LanguageProfile = TYPESCRIPT,
): PlanChecksResult {
  const abs = path.resolve(root, checksPath);
  if (!isRegularFile(abs)) {
    return {
      ok: false,
      result: { code: 4, document: errorDocument(4, "UsageError", "checks file not found: " + checksPath) },
    };
  }
  const parsed = parseDocument(fs.readFileSync(abs, "utf8"), checksPath);
  if (!parsed.ok) {
    return {
      ok: false,
      result: { code: 2, document: errorDocument(2, "DeckError", parsed.error) },
    };
  }
  const validated = validateChecks(parsed.doc);
  if (!validated.ok) {
    const n = validated.problems.length;
    return {
      ok: false,
      result: {
        code: 2,
        document: errorDocument(
          2,
          "DeckError",
          checksPath +
            " is not a valid checks document (" +
            n +
            " problem" +
            (n === 1 ? "" : "s") +
            "):\n" +
            validated.problems.join("\n"),
        ),
      },
    };
  }
  const guardAbs = path.resolve(root, GUARD_PATH);
  if (!isRegularFile(guardAbs)) {
    return {
      ok: false,
      result: { code: 4, document: errorDocument(4, "UsageError", "guard file not found: " + GUARD_PATH) },
    };
  }
  const locatorAbs = path.resolve(root, LOCATOR_PATH);
  if (!isRegularFile(locatorAbs)) {
    return {
      ok: false,
      result: { code: 4, document: errorDocument(4, "UsageError", "locator file not found: " + LOCATOR_PATH) },
    };
  }
  const probes: Record<string, string> = {};
  for (const card of validated.checks.cards) {
    if (card.files !== null) continue;
    const probeAbs = path.resolve(root, validated.checks.parts, probeFile(profile, card.id));
    if (isRegularFile(probeAbs)) {
      probes[card.id] = fs.readFileSync(probeAbs, "utf8");
    }
  }
  return {
    ok: true,
    checks: validated.checks,
    texts: {
      guard: fs.readFileSync(guardAbs, "utf8"),
      firstdiff: fs.readFileSync(locatorAbs, "utf8"),
      probes,
    },
  };
}
