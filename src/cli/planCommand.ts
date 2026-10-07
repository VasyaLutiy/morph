import fs from "node:fs";
import path from "node:path";
import { loadContour, loadMap } from "../contour/load.js";
import { planSpec } from "../planner/plan.js";
import { errorDocument } from "./document.js";
import type { ContourMap } from "../contour/types.js";
import type { PlanResult } from "../planner/types.js";
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
  const plan = planned.plan;

  if (args.out !== null) {
    const outAbs = path.resolve(root, args.out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(plan.cards, null, 2) + "\n", "utf8");
  }

  return {
    code: 0,
    document: {
      spec: plan.spec,
      components: plan.components,
      cards: plan.cards,
      generations: plan.generations,
      externalDependsOn: plan.externalDependsOn,
      out: args.out,
    },
  };
}
