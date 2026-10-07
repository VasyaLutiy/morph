import { functionLinks } from "../contour/select.js";
import { cutTargets, slugName } from "../language/naming.js";
import { resolveProfile } from "../language/profiles.js";
import { acceptanceScript } from "../language/template.js";
import {
  codeBudget,
  functionSection,
  inheritedSection,
  interfaceSection,
  preamble,
} from "./render.js";
import type { Card } from "../cards/types.js";
import type {
  Component,
  ContourFunction,
  ContourInterface,
  MapGroup,
} from "../contour/types.js";
import type { CutCard, CutInput, CutResult, Unit, UnitsResult } from "./types.js";

export function cutUnits(component: Component, groups: readonly MapGroup[]): UnitsResult {
  const known = new Set(component.functions.map((f) => f.name));
  for (const group of groups) {
    const knownNames = group.functions.filter((n) => known.has(n));
    if (knownNames.length === 0) continue;
    const unknownName = group.functions.find((n) => !known.has(n));
    if (unknownName !== undefined) {
      return {
        ok: false,
        error:
          `group '${group.name}' names unknown Function '${unknownName}' next to ` +
          `'${knownNames[0]}' of Component '${component.name}': a group names the Functions of one Component`,
      };
    }
  }
  const groupOfFunction = new Map<string, MapGroup>();
  for (const group of groups) {
    if (!group.functions.some((n) => known.has(n))) continue;
    for (const name of group.functions) groupOfFunction.set(name, group);
  }
  const placed = new Set<string>();
  const units: Unit[] = [];
  for (const fn of component.functions) {
    const group = groupOfFunction.get(fn.name);
    if (group === undefined) {
      units.push({ id: slugName(fn.name), name: fn.name, functions: [fn], isGroup: false });
    } else if (!placed.has(group.name)) {
      placed.add(group.name);
      const functions = component.functions.filter((f) => group.functions.includes(f.name));
      units.push({ id: slugName(group.name), name: group.name, functions, isGroup: true });
    }
  }
  return { ok: true, units };
}

interface Base {
  baseId: string;
  targets: string[];
  deps: string[];
  maxTokens: number;
  variants: number;
  functions: ContourFunction[];
  interfaceSections: { iface: ContourInterface; ownerBaseIds: string[] }[];
}

export function cutComponent(input: CutInput): CutResult {
  const { record, component, map, docs, spec } = input;

  const profileResult = resolveProfile(component.language, map.language);
  if (!profileResult.ok) {
    return { ok: false, error: `Component '${component.name}': ${profileResult.error}` };
  }
  const profile = profileResult.profile;

  const linksResult = functionLinks(record, component);
  if (!linksResult.ok) return { ok: false, error: linksResult.errors[0] };
  const links = linksResult.links;

  const unitsResult = cutUnits(component, map.groups);
  if (!unitsResult.ok) return { ok: false, error: unitsResult.error };
  const units = unitsResult.units;

  const ownerByFunction = new Map<string, string>();
  for (const unit of units) {
    for (const fn of unit.functions) ownerByFunction.set(fn.name, unit.id);
  }

  const bases: Base[] = [];
  for (const unit of units) {
    const targetsResult = cutTargets(profile, component.name, unit.name);
    if (!targetsResult.ok) return { ok: false, error: targetsResult.error };
    const deps: string[] = [];
    let steps = 0;
    let examples = 0;
    for (const fn of unit.functions) {
      steps += fn.steps.length;
      examples += fn.examples.length;
      const link = links.find((l) => l.function === fn.name);
      if (link === undefined) continue;
      for (const call of link.calls) {
        const owner = ownerByFunction.get(call);
        if (owner !== undefined && owner !== unit.id && !deps.includes(owner)) deps.push(owner);
      }
    }
    const budget = codeBudget(steps, unit.functions.length, unit.isGroup, examples);
    bases.push({
      baseId: unit.id,
      targets: [targetsResult.targets.code, targetsResult.targets.test],
      deps,
      maxTokens: budget.maxTokens,
      variants: budget.variants,
      functions: unit.functions,
      interfaceSections: [],
    });
  }

  const functionNames = new Set(component.functions.map((f) => f.name));
  for (const iface of component.interfaces) {
    for (const name of iface.exposes) {
      if (!functionNames.has(name)) {
        return { ok: false, error: `Interface '${iface.name}' exposes unknown Function '${name}'` };
      }
    }
  }
  for (const iface of component.interfaces) {
    const owners = iface.exposes.map((n) => ownerByFunction.get(n) as string);
    if (iface.exposes.length === 1) {
      const owner = bases.find((b) => b.baseId === owners[0]);
      if (owner !== undefined) {
        owner.interfaceSections.push({ iface, ownerBaseIds: [owner.baseId] });
      }
    } else {
      const targetsResult = cutTargets(profile, component.name, iface.name);
      if (!targetsResult.ok) return { ok: false, error: targetsResult.error };
      const deps: string[] = [];
      for (const owner of owners) {
        if (!deps.includes(owner)) deps.push(owner);
      }
      const budget = codeBudget(0, 1, false, 0);
      bases.push({
        baseId: slugName(iface.name),
        targets: [targetsResult.targets.code, targetsResult.targets.test],
        deps,
        maxTokens: budget.maxTokens,
        variants: budget.variants,
        functions: [],
        interfaceSections: [{ iface, ownerBaseIds: owners }],
      });
    }
  }

  const seen = new Set<string>();
  for (const base of bases) {
    if (seen.has(base.baseId)) {
      return { ok: false, error: `duplicate customId '${base.baseId}'` };
    }
    seen.add(base.baseId);
  }

  const finalIds = new Map<string, string>();
  const finalTargets = new Map<string, string[]>();
  for (const base of bases) {
    const override = map.cards.find((c) => c.id === base.baseId);
    finalIds.set(base.baseId, override?.customId ?? base.baseId);
    finalTargets.set(base.baseId, override?.targets ?? base.targets);
  }

  const cuts: CutCard[] = [];
  for (const base of bases) {
    const override = map.cards.find((c) => c.id === base.baseId);
    const customId = finalIds.get(base.baseId) as string;
    const targets = finalTargets.get(base.baseId) as string[];
    const dependsOn = (override?.dependsOn ?? base.deps).map((d) => finalIds.get(d) ?? d);

    let sliceDefault = [...docs];
    for (const dep of dependsOn) {
      const depBase = bases.find((b) => finalIds.get(b.baseId) === dep);
      if (depBase === undefined) continue;
      const depTarget = (finalTargets.get(depBase.baseId) as string[])[0];
      if (!sliceDefault.includes(depTarget)) sliceDefault.push(depTarget);
    }
    if (sliceDefault.length === 0) sliceDefault = [targets[0]];
    const contextSlice = override?.contextSlice ?? sliceDefault;

    const blocks: string[] = [preamble(docs, spec)];
    for (const fn of base.functions) blocks.push(functionSection(record, fn));
    for (const entry of base.interfaceSections) {
      const modules = entry.ownerBaseIds.map(
        (id) => (finalTargets.get(id) as string[])[0],
      );
      blocks.push(interfaceSection(entry.iface, modules));
    }
    const inherited = inheritedSection(record, component);
    if (inherited !== "") blocks.push(inherited);
    blocks.push("Write the files: " + targets.map((t) => "`" + t + "`").join(", ") + ".");
    blocks.push(profile.finale);
    const instruction =
      override?.instruction != null
        ? [override.instruction, ...blocks.slice(1)].join("\n\n")
        : blocks.join("\n\n");

    const card: Card = {
      customId,
      intent: override?.intent ?? "patch",
      targets,
      contextSlice,
      instruction,
      acceptance: override?.acceptance ?? acceptanceScript(profile, customId, targets),
      model: override?.model ?? null,
      maxTokens: override?.maxTokens ?? base.maxTokens,
      reasoning: { maxTokens: override?.reasoningMaxTokens ?? 2500 },
      variants: override?.variants ?? base.variants,
      dependsOn,
    };
    cuts.push({
      card,
      component,
      profile,
      functions: base.functions,
      slicedByMap: (override?.contextSlice ?? null) !== null,
    });
  }
  return { ok: true, cuts };
}
