import fs from "node:fs";
import path from "node:path";
import type { Deck } from "../cards/types.js";
import { PROFILES } from "../language/profiles.js";
import { treeProfileFor } from "../language/treeProfiles.js";
import type { TreeLanguage } from "../planner/stubTrees.js";
import { stubTrees } from "../planner/stubTrees.js";
import { findBreaks, treeCheck } from "../acceptance/treeCheck.js";

export interface BuildCheck {
  card: string;
  generation: number;
  language: string | null;
  stubbed: number;
  missing: string[];
  breaks: string[];
  note: string | null;
}

const TIMEOUT_MS = 120000;
const TIMEOUT_NOTE = "the compile step timed out after 120000 ms";

// Every regular file under `dir`, relative to it, "/"-joined, sorted. A
// symbolic link is not followed (Dirent.isFile is false for it).
function walkFiles(dir: string, prefix: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const rel = prefix === "" ? entry.name : prefix + "/" + entry.name;
    if (entry.isDirectory()) {
      walkFiles(path.join(dir, entry.name), rel, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function checkBuilds(
  root: string,
  deckPath: string,
  deck: Deck,
  generations: string[][],
  env: Record<string, string>,
): BuildCheck[] | null {
  const stubDir = path.posix.join(path.posix.dirname(deckPath), "_stubs");
  if (!isDirectory(path.resolve(root, stubDir))) return null;

  const stubs: string[] = [];
  walkFiles(path.resolve(root, stubDir), "", stubs);
  stubs.sort();

  const languages: TreeLanguage[] = PROFILES.map((p) => {
    const profile = treeProfileFor(p.id);
    return { id: p.id, extensions: [...p.extensions], config: profile === null ? null : profile.config };
  });

  const trees = stubTrees(deck.cards, generations, stubDir, stubs, languages);
  const checks: BuildCheck[] = [];

  for (const tree of trees) {
    const base: BuildCheck = {
      card: tree.card,
      generation: tree.generation,
      language: tree.language,
      stubbed: Object.keys(tree.stubs).length,
      missing: tree.missing,
      breaks: [],
      note: null,
    };

    if (tree.language === null) {
      const claimed = tree.own[0];
      base.note = "no language profile claims " + (claimed === undefined ? "no target" : claimed) + ": not built";
      checks.push(base);
      continue;
    }

    const id = tree.language;
    const profile = treeProfileFor(id);
    const command = profile === null ? null : profile.command;
    const configName = profile === null ? null : profile.config;
    if (command === null || configName === null) {
      base.note = id + " has no compile or typecheck step: not built";
      checks.push(base);
      continue;
    }

    if (tree.config === null) {
      base.note = "the acceptance writes no $P/" + configName + ": not built";
      checks.push(base);
      continue;
    }

    const run = treeCheck(
      root,
      {
        card: tree.card,
        exports: tree.exports,
        config: tree.config,
        stubs: tree.stubs,
        command,
      },
      env,
      TIMEOUT_MS,
    );

    const fileLine = profile === null ? "" : profile.fileLine;
    const breaks = findBreaks(run.output, fileLine, tree.own);
    if (run.timedOut) breaks.push(TIMEOUT_NOTE);
    base.breaks = breaks;
    checks.push(base);
  }

  return checks;
}
