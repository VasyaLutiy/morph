import { componentSlug, selectComponents } from "../contour/select.js";
import { resolveProfile } from "../language/profiles.js";
import { cutComponent } from "./cut.js";
import { cutJudges } from "./judges.js";
import type { Card } from "../cards/types.js";
import type { CutCard, OrderResult, PlanInput, PlanResult } from "./types.js";

export function orderDeck(cards: readonly Card[]): OrderResult {
  const ids = new Set<string>(cards.map((c) => c.customId));
  const placed = new Set<string>();
  const pending: Card[] = [...cards];
  const ordered: Card[] = [];
  const generations: string[][] = [];
  while (pending.length > 0) {
    const ready = pending.filter((c) =>
      c.dependsOn.every((d) => !ids.has(d) || placed.has(d)),
    );
    if (ready.length === 0) {
      const cycle = pending.map((c) => c.customId).sort().join(", ");
      return { ok: false, error: `dependency cycle among ${cycle}` };
    }
    const layerIds = ready.map((c) => c.customId).sort();
    generations.push(layerIds);
    for (const id of layerIds) placed.add(id);
    ready.sort((a, b) => (a.customId < b.customId ? -1 : a.customId > b.customId ? 1 : 0));
    for (const card of ready) {
      const index = pending.indexOf(card);
      pending.splice(index, 1);
    }
    ordered.push(...ready);
  }
  const externalDependsOn: Record<string, string[]> = {};
  for (const card of ordered) {
    const external = card.dependsOn.filter((d) => !ids.has(d));
    if (external.length > 0) externalDependsOn[card.customId] = external;
  }
  return { ok: true, cards: ordered, generations, externalDependsOn };
}

function extraCard(extra: {
  customId: string | null;
  intent: "generate" | "patch" | null;
  targets: string[] | null;
  contextSlice: string[] | null;
  instruction: string | null;
  acceptance: string | null;
  model: string | null;
  maxTokens: number | null;
  reasoningMaxTokens: number | null;
  variants: number | null;
  dependsOn: string[] | null;
}): Card {
  return {
    customId: extra.customId as string,
    intent: extra.intent ?? "patch",
    targets: extra.targets as string[],
    contextSlice: extra.contextSlice ?? [],
    instruction: extra.instruction as string,
    acceptance: extra.acceptance ?? null,
    model: extra.model ?? null,
    maxTokens: extra.maxTokens ?? null,
    reasoning:
      extra.reasoningMaxTokens !== null
        ? { maxTokens: extra.reasoningMaxTokens as number }
        : null,
    variants: extra.variants ?? 1,
    dependsOn: extra.dependsOn ?? [],
  };
}

export function planSpec(input: PlanInput): PlanResult {
  const { record, map, spec, components, judge, hasFile } = input;

  const profileResult = resolveProfile(null, map.language);
  if (!profileResult.ok) return { ok: false, error: `the map: ${profileResult.error}` };
  const mapProfile = profileResult.profile;

  const select = selectComponents(record, components);
  if (!select.ok) return { ok: false, error: select.error };
  const selected = select.components;

  const docs = map.docs.filter((d) => d !== spec);

  const cuts: CutCard[] = [];
  for (const component of selected) {
    const cut = cutComponent({ record, component, map, docs, spec });
    if (!cut.ok) return { ok: false, error: cut.error };
    cuts.push(...cut.cuts);
  }

  const byId = new Map<string, CutCard>();
  for (const cut of cuts) byId.set(cut.card.customId, cut);
  for (const cut of cuts) {
    if (cut.slicedByMap) continue;
    for (const dep of cut.card.dependsOn) {
      const other = byId.get(dep);
      if (other === undefined) continue;
      if (other.component === null || cut.component === null) continue;
      if (other.component.name === cut.component.name) continue;
      const target = other.card.targets[0];
      if (!cut.card.contextSlice.includes(target)) cut.card.contextSlice.push(target);
    }
  }

  const all: CutCard[] = [...cuts];
  const recordNames = record.system.groups.map((c) => c.name).join(", ");
  for (const extra of map.extraCards) {
    const comp = extra.component;
    if (comp !== null) {
      const match = record.system.groups.find(
        (c) => c.name === comp || componentSlug(c.name) === componentSlug(comp),
      );
      if (match === undefined) {
        return {
          ok: false,
          error:
            `extra card '${extra.customId}' names Component '${comp}' ` +
            `the record does not have (have: ${recordNames})`,
        };
      }
      if (!selected.some((s) => s.name === match.name)) continue;
    }
    all.push({
      card: extraCard(extra),
      component: null,
      profile: null,
      functions: [],
      slicedByMap: true,
    });
  }

  if (judge) {
    const judgeCards = cutJudges({
      record,
      cuts: all,
      map,
      docs,
      defaultProfile: mapProfile,
      hasFile,
    });
    for (const card of judgeCards) {
      all.push({ card, component: null, profile: null, functions: [], slicedByMap: true });
    }
  }

  for (const cut of all) {
    cut.card.contextSlice = cut.card.contextSlice.filter((p) => p !== spec);
  }

  const seen = new Set<string>();
  for (const cut of all) {
    const id = cut.card.customId;
    if (seen.has(id)) return { ok: false, error: `duplicate customId '${id}'` };
    seen.add(id);
  }

  const order = orderDeck(all.map((c) => c.card));
  if (!order.ok) return { ok: false, error: order.error };

  return {
    ok: true,
    plan: {
      spec,
      components: selected.map((c) => c.name),
      cards: order.cards,
      generations: order.generations,
      externalDependsOn: order.externalDependsOn,
    },
  };
}
