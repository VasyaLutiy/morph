import type {
  Component,
  ContourFunction,
  ContourInterface,
  ContourRecord,
  Definition,
} from "../contour/types.js";
import type { Example } from "../contour/types.js";
import type { Budget } from "./types.js";

export const EXAMPLES_HEADING = "Examples (the tests must prove each one):";
export const MAX_TOKENS_CAP = 32000;
export const REASONING_MAX_TOKENS = 2500;

function collapse(text: string): string {
  return text.split(/\s+/).filter((w) => w !== "").join(" ");
}

export function renderExamples(examples: readonly Example[]): string {
  return examples
    .map((e, i) => {
      const base =
        `${i + 1}. given ${collapse(e.given)}; when ${collapse(e.when)}; then ${collapse(e.then)}`;
      return e.ref === null ? base : `${base} (ref: ${collapse(e.ref)})`;
    })
    .join("\n");
}

function findDataObject(record: ContourRecord, name: string): Definition & { schema: string | null } | null {
  for (const component of record.system.groups) {
    const dataObject = component.dataObjects.find((d) => d.name === name);
    if (dataObject !== undefined) return dataObject;
  }
  return null;
}

export function dataBlocks(
  record: ContourRecord,
  functions: readonly ContourFunction[],
): string[] {
  const taken = new Set<string>();
  const blocks: string[] = [];
  for (const fn of functions) {
    for (const step of fn.steps) {
      if (step.verb !== "reads" && step.verb !== "modifies" && step.verb !== "produces") continue;
      if (taken.has(step.target)) continue;
      const dataObject = findDataObject(record, step.target);
      if (dataObject === null) continue;
      taken.add(step.target);
      blocks.push(
        dataObject.schema === null
          ? `Data ${dataObject.name}: ${dataObject.description}`
          : `Data ${dataObject.name}: ${dataObject.description}\nSchema:\n${dataObject.schema}`,
      );
    }
  }
  return blocks;
}

function definitionLine(list: readonly Definition[], name: string): string {
  const definition = list.find((d) => d.name === name);
  return definition === undefined
    ? `- ${name} (definition not found in the record)`
    : `- ${definition.name}: ${definition.description}`;
}

export function functionSection(record: ContourRecord, fn: ContourFunction): string {
  const blocks: string[] = [];
  blocks.push(`## Function ${fn.name}`);
  if (fn.description !== "") blocks.push(fn.description);
  if (fn.behavior !== "") blocks.push(`Behaviour: ${fn.behavior}`);
  if (fn.preconditions.length > 0) {
    blocks.push(["Preconditions:", ...fn.preconditions.map((p) => `- ${p}`)].join("\n"));
  }
  if (fn.steps.length > 0) {
    blocks.push(["Steps:", ...fn.steps.map((s) => `- ${s.verb}: ${s.target}`)].join("\n"));
  }
  blocks.push(`${EXAMPLES_HEADING}\n${renderExamples(fn.examples)}`);
  for (const block of dataBlocks(record, [fn])) blocks.push(block);
  if (fn.requirements.length > 0) {
    blocks.push(["Requirements:", ...fn.requirements.map((n) => definitionLine(record.requirements, n))].join("\n"));
  }
  if (fn.guardrails.length > 0) {
    blocks.push(["Guardrails:", ...fn.guardrails.map((n) => definitionLine(record.guardrails, n))].join("\n"));
  }
  return blocks.join("\n\n");
}

export function preamble(docs: readonly string[], spec: string): string {
  if (docs.length > 0) {
    return `Read ${docs.join(", ")} FIRST (in your context). Every name you need is in them or below; do not invent names, keys or files.`;
  }
  return `Every name you need is below -- the record \`${spec}\` is cut into this instruction; do not invent names, keys or files.`;
}

function distinctNames(first: readonly string[], second: readonly string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of [...first, ...second]) {
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function inheritedSection(record: ContourRecord, component: Component): string {
  const requirements = distinctNames(record.system.requirements, component.requirements);
  const guardrails = distinctNames(record.system.guardrails, component.guardrails);
  if (requirements.length === 0 && guardrails.length === 0) return "";
  const blocks: string[] = ["## Component requirements / guardrails"];
  if (requirements.length > 0) {
    blocks.push(["Requirements:", ...requirements.map((n) => definitionLine(record.requirements, n))].join("\n"));
  }
  if (guardrails.length > 0) {
    blocks.push(["Guardrails:", ...guardrails.map((n) => definitionLine(record.guardrails, n))].join("\n"));
  }
  return blocks.join("\n\n");
}

export function interfaceSection(iface: ContourInterface, modules: readonly string[]): string {
  const blocks: string[] = [`## Interface ${iface.name}`, iface.description];
  blocks.push([
    "Exposes:",
    ...iface.exposes.map((name, i) => `- ${name} (\`${modules[i] ?? ""}\`)`),
  ].join("\n"));
  return blocks.join("\n\n");
}

export function codeBudget(
  steps: number,
  members: number,
  isGroup: boolean,
  examples: number,
): Budget {
  return {
    maxTokens: Math.min(
      MAX_TOKENS_CAP,
      12000 + 2000 * steps + 4000 * (members - 1) + 500 * examples,
    ),
    reasoningMaxTokens: REASONING_MAX_TOKENS,
    variants: steps >= 3 || isGroup ? 2 : 1,
  };
}

export function judgeBudget(examples: number): Budget {
  return {
    maxTokens: Math.min(MAX_TOKENS_CAP, 16000 + 1000 * examples),
    reasoningMaxTokens: REASONING_MAX_TOKENS,
    variants: 1,
  };
}
