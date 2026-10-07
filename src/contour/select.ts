import type { Component, ContourRecord, FunctionLink, LinksResult, SelectResult } from "./types.js";

export function componentSlug(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== "")
    .join("-");
}

export function selectComponents(record: ContourRecord, names: readonly string[]): SelectResult {
  const groups = record.system.groups;
  if (names.length === 0) {
    if (groups.length === 1) return { ok: true, components: [groups[0]] };
    const all = groups.map((c) => c.name).join(", ");
    return { ok: false, error: `the record has ${groups.length} Components (${all}): pass --component` };
  }
  const selected: Component[] = [];
  for (const name of names) {
    const match = groups.find(
      (c) => c.name === name || componentSlug(c.name) === componentSlug(name),
    );
    if (match === undefined) {
      const all = groups.map((c) => c.name).join(", ");
      return { ok: false, error: `no Component '${name}' in the record (have: ${all})` };
    }
    if (!selected.includes(match)) selected.push(match);
  }
  return { ok: true, components: selected };
}

export function functionLinks(record: ContourRecord, component: Component): LinksResult {
  const dataObjects = new Set<string>();
  for (const c of record.system.groups) {
    for (const d of c.dataObjects) dataObjects.add(d.name);
  }
  const functionNames = new Set(component.functions.map((f) => f.name));
  const errors: string[] = [];
  const links: FunctionLink[] = [];
  for (const f of component.functions) {
    const link: FunctionLink = { function: f.name, calls: [], dataObjects: [], uses: [] };
    for (const step of f.steps) {
      if (step.verb === "calls") {
        if (step.target === f.name) {
          errors.push(`Function '${f.name}' calls itself`);
        } else if (!functionNames.has(step.target)) {
          errors.push(
            `Function '${f.name}' calls unknown Function '${step.target}' of Component '${component.name}'`,
          );
        } else if (!link.calls.includes(step.target)) {
          link.calls.push(step.target);
        }
      } else if (step.verb === "uses") {
        if (!link.uses.includes(step.target)) link.uses.push(step.target);
      } else if (dataObjects.has(step.target) && !link.dataObjects.includes(step.target)) {
        link.dataObjects.push(step.target);
      }
    }
    links.push(link);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, links };
}
