import fs from "node:fs";
import path from "node:path";
import { loadContour, loadMap } from "../contour/load.js";
import { planSpec } from "../planner/plan.js";
import { selectCards } from "../planner/selectCards.js";
import { hideLater } from "../planner/hideLater.js";
import { buildAcceptances } from "../builder/buildAcceptances.js";
import { resolveProfile } from "../language/profiles.js";
import { readPlanChecks } from "./readPlanChecks.js";
import { readGoTree } from "./goTree.js";
import { errorDocument } from "./document.js";
import type { ContourMap } from "../contour/types.js";
import type { PlanResult } from "../planner/types.js";
import type { Card } from "../cards/types.js";
import type { CommandResult, PlanArgs } from "./types.js";

export const EMPTY_MAP: ContourMap = {
  version: 1,
  package: null,
  language: null,
  docs: [],
  groups: [],
  cards: [],
  extraCards: [],
};

function isRegularFile(abs: string): boolean {
  let isFile = false;
  try {
    isFile = fs.statSync(abs).isFile();
  } catch {
    isFile = false;
  }
  return isFile;
}

export function planCommand(root: string, args: PlanArgs): CommandResult {
  const specAbs = path.resolve(root, args.spec);
  if (!isRegularFile(specAbs)) {
    return {
      code: 4,
      document: errorDocument(4, "UsageError", "spec file not found: " + args.spec),
    };
  }
  if (args.map !== null) {
    const mapAbs = path.resolve(root, args.map);
    if (!isRegularFile(mapAbs)) {
      return {
        code: 4,
        document: errorDocument(4, "UsageError", "map file not found: " + args.map),
      };
    }
  }

  const loadedRecord = loadContour(fs.readFileSync(specAbs, "utf8"), args.spec);
  if (!loadedRecord.ok) {
    return { code: 2, document: errorDocument(2, "DeckError", loadedRecord.error) };
  }
  const record = loadedRecord.record;

  let map: ContourMap = EMPTY_MAP;
  if (args.map !== null) {
    const loadedMap = loadMap(fs.readFileSync(path.resolve(root, args.map), "utf8"), args.map);
    if (!loadedMap.ok) {
      return { code: 2, document: errorDocument(2, "DeckError", loadedMap.error) };
    }
    map = loadedMap.map;
  }

  const hasFile = (p: string): boolean => isRegularFile(path.resolve(root, p));

  const planned: PlanResult = planSpec({
    record,
    map,
    spec: args.spec,
    components: args.components,
    judge: args.judge,
    hasFile,
  });
  if (!planned.ok) {
    return { code: 2, document: errorDocument(2, "DeckError", planned.error) };
  }

  let plan = planned.plan;
  if (args.only !== undefined) {
    const selected = selectCards(plan, args.only);
    if (!selected.ok) {
      return { code: 2, document: errorDocument(2, "DeckError", selected.error) };
    }
    plan = selected.plan;
  }

  let cards: Card[] = plan.cards;
  if (args.checks !== undefined) {
    const first = record.system.groups.find((g) => g.name === plan.components[0]);
    const profiled = resolveProfile(first?.language ?? null, map.language);
    if (!profiled.ok) {
      return { code: 2, document: errorDocument(2, "DeckError", "the map: " + profiled.error) };
    }
    const read = readPlanChecks(root, args.checks, profiled.profile);
    if (!read.ok) {
      return read.result;
    }
    let checks = read.checks;
    if (args.only !== undefined) {
      const kept = new Set<string>(plan.cards.map((card) => card.customId));
      checks = { ...checks, cards: checks.cards.filter((c) => kept.has(c.id)) };
    }
    const input = {
      cards: plan.cards,
      checks,
      profile: profiled.profile,
      texts: read.texts,
      uses: planned.uses,
      vendor: hasFile("vendor/modules.txt"),
    };
    const built = buildAcceptances(
      args.only !== undefined && profiled.profile.id === "go"
        ? { ...input, hide: hideLater(plan, readGoTree(root)) }
        : input,
    );
    if (!built.ok) {
      const n = built.errors.length;
      return {
        code: 2,
        document: errorDocument(
          2,
          "DeckError",
          "acceptances not built (" +
            n +
            " error" +
            (n === 1 ? "" : "s") +
            "):\n" +
            built.errors.join("\n"),
        ),
      };
    }
    const overridden = new Set<string>();
    for (const m of map.cards) {
      if (m.acceptance !== null) overridden.add(m.customId ?? m.id);
    }
    for (const e of map.extraCards) {
      if (e.acceptance !== null && e.customId !== null) overridden.add(e.customId);
    }
    cards = built.cards.map((c, i) => (overridden.has(c.customId) ? plan.cards[i] : c));
  }

  if (args.out !== null) {
    const outAbs = path.resolve(root, args.out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(cards, null, 2) + "\n", "utf8");
  }

  return {
    code: 0,
    document: {
      spec: plan.spec,
      components: plan.components,
      cards,
      generations: plan.generations,
      externalDependsOn: plan.externalDependsOn,
      out: args.out,
    },
  };
}
