import type { ContourMap, ContourRecord } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";

export const GUARD_CONTRACT = "morph-guard-contract: 2";
export type LayerEdgesResult = { ok: true; edges: Record<string, string[]> } | { ok: false; errors: string[] };
export type PlanLayersResult = { ok: true; layers: Record<string, string[]> | null } | { ok: false; error: string };

export function layerEdges(record: ContourRecord, map: ContourMap): LayerEdgesResult {
  throw new Error("stub layerEdges " + String(record.version) + String(map.version));
}

export function cardLayers(profile: LanguageProfile, targets: readonly string[], edges: Record<string, string[]>): Record<string, string[]> {
  throw new Error("stub cardLayers " + profile.id + targets.join(",") + Object.keys(edges).join(","));
}

export function layersArg(allowed: readonly string[], layers: Record<string, string[]> | undefined): string {
  throw new Error("stub layersArg " + allowed.join(",") + String(layers === undefined));
}

export function planLayers(record: ContourRecord, map: ContourMap, layersFile: boolean, guard: string, language: string): PlanLayersResult {
  throw new Error("stub planLayers " + String(record.version) + String(map.version) + String(layersFile) + guard + language);
}
