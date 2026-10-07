import { posix } from "node:path";
import { componentSlug } from "../contour/select.js";
import { codeTargets, profileForPath, testTarget } from "../language/paths.js";
import { fillTemplate } from "../language/profiles.js";
import { acceptanceScript, judgeInstruction } from "../language/template.js";
import type { Card } from "../cards/types.js";
import type { Component, ContourFunction, ContourMap, ContourRecord } from "../contour/types.js";
import type { MapCard } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";
import { dataBlocks, judgeBudget, renderExamples } from "./render.js";
import type { CutCard, JudgeInput } from "./types.js";

const EXAMPLES_LINE_FIRST = "The examples below are the criterion, and you are its independent author: write one test per example (no fewer, no merging), each named after the Function and the example number, e.g. \"";
const EXAMPLES_LINE_LAST = " example 1\".";

export function judgeTarget(profile: LanguageProfile, code: string): string {
  return fillTemplate(profile.judgeTarget, {
    component: posix.basename(posix.dirname(code)),
    name: posix.basename(code, posix.extname(code)),
  });
}

function findOverride(map: ContourMap, id: string): MapCard | null {
  return map.cards.find((c) => c.id === id) ?? null;
}

function callees(component: Component | null, functions: readonly ContourFunction[]): ContourFunction[] {
  if (component === null) return [];
  const own = new Set(functions.map((f) => f.name));
  const names: string[] = [];
  for (const fn of functions) {
    for (const step of fn.steps) {
      if (step.verb !== "calls") continue;
      if (own.has(step.target)) continue;
      if (component.functions.some((f) => f.name === step.target) && !names.includes(step.target)) {
        names.push(step.target);
      }
    }
  }
  return names.map((n) => component.functions.find((f) => f.name === n) as ContourFunction);
}

function usedComponents(
  record: ContourRecord,
  component: Component | null,
  functions: readonly ContourFunction[],
): Component[] {
  const used: Component[] = [];
  for (const fn of functions) {
    for (const step of fn.steps) {
      if (step.verb !== "uses") continue;
      for (const c of record.system.groups) {
        if (component !== null && c.name === component.name) continue;
        if (c.name === step.target || componentSlug(c.name) === componentSlug(step.target)) {
          if (!used.some((u) => u.name === c.name)) used.push(c);
          break;
        }
      }
    }
  }
  return used;
}

function preconditionLines(input: JudgeInput, cut: CutCard, calleesOf: readonly ContourFunction[]): string[] {
  const lines: string[] = [];
  const push = (componentName: string, fn: ContourFunction): void => {
    for (const p of fn.preconditions) {
      const line = `- ${componentName} · ${fn.name} · ${p}`;
      if (!lines.includes(line)) lines.push(line);
    }
  };
  const own = cut.component;
  if (own !== null) {
    for (const fn of cut.functions) push(own.name, fn);
    for (const fn of calleesOf) push(own.name, fn);
    for (const c of usedComponents(input.record, own, cut.functions)) {
      for (const fn of c.functions) push(c.name, fn);
    }
  }
  return lines;
}

export function cutJudges(input: JudgeInput): Card[] {
  const cards: Card[] = [];
  for (const cut of input.cuts) {
    const base = cut.card;
    const profile =
      cut.profile ??
      (base.targets.length > 0 ? profileForPath(base.targets[0]) : null) ??
      input.defaultProfile;
    const code = codeTargets(profile, base.targets);
    if (code.length === 0) continue;
    const builtId = `${base.customId}-judge`;
    const override = findOverride(input.map, builtId);
    const defaultTarget = judgeTarget(profile, code[0]);
    const targets = override !== null && override.targets !== null ? override.targets : [defaultTarget];
    const dependsOn: string[] = [base.customId];
    if (override !== null && override.dependsOn !== null) {
      for (const dep of override.dependsOn) {
        if (!dependsOn.includes(dep)) dependsOn.push(dep);
      }
    }
    const test = testTarget(profile, targets) ?? targets[0];
    const blocks: string[] = [
      judgeInstruction(profile, { test, module: code[0], docs: [...input.docs] }),
    ];
    if (cut.functions.length > 0) {
      blocks.push(
        EXAMPLES_LINE_FIRST + cut.functions[0].name + EXAMPLES_LINE_LAST,
      );
      for (const fn of cut.functions) {
        blocks.push(`Examples of Function ${fn.name}:\n${renderExamples(fn.examples)}`);
      }
      for (const block of dataBlocks(input.record, cut.functions)) blocks.push(block);
      for (const callee of callees(cut.component, cut.functions)) {
        blocks.push(`Callee ${callee.name}: ${callee.description}\nBehaviour: ${callee.behavior}`);
      }
      const preconditions = preconditionLines(input, cut, callees(cut.component, cut.functions));
      if (preconditions.length > 0) {
        blocks.push(["Preconditions a test's setup depends on:", ...preconditions].join("\n"));
      }
    }
    const instruction =
      override !== null && override.instruction !== null
        ? [override.instruction, ...blocks.slice(1)].join("\n\n")
        : blocks.join("\n\n");
    const contextSlice: string[] = [...input.docs];
    if (!contextSlice.includes(code[0])) contextSlice.push(code[0]);
    const helpers = profile.helpersModule;
    if (input.hasFile(helpers) && !contextSlice.includes(helpers)) contextSlice.push(helpers);
    const slice = override !== null && override.contextSlice !== null ? override.contextSlice : contextSlice;
    const budget = judgeBudget(cut.functions.reduce((n, f) => n + f.examples.length, 0));
    cards.push({
      customId: builtId,
      intent: (override !== null && override.intent !== null ? override.intent : "patch"),
      targets,
      contextSlice: slice,
      instruction,
      acceptance:
        override !== null && override.acceptance !== null
          ? override.acceptance
          : acceptanceScript(profile, builtId, targets),
      model: override !== null ? override.model : null,
      maxTokens: override !== null && override.maxTokens !== null ? override.maxTokens : budget.maxTokens,
      reasoning: {
        maxTokens:
          override !== null && override.reasoningMaxTokens !== null ? override.reasoningMaxTokens : 2500,
      },
      variants: override !== null && override.variants !== null ? override.variants : 1,
      dependsOn,
    });
  }
  return cards;
}
