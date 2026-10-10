import type { ScoutFs, ScoutTree } from "./cagePath.js";
import type { ScoutBudgets, ScoutSpent } from "./spendBudget.js";

export const ANSWER_SHAPE: string = "stub";
export const ROUND0_CLUES: number = 0;
export const ROUND0_HITS: number = 0;
export const ROUND0_HEADER: string = "stub";

export function budgetSentence(budgets: ScoutBudgets): string {
  throw new Error("stub budgetSentence " + String(budgets.calls));
}
export function budgetLeft(budgets: ScoutBudgets, spent: ScoutSpent): string {
  throw new Error("stub budgetLeft " + String(budgets.calls) + String(spent.calls));
}
export function notRun(skipped: string[]): string {
  throw new Error("stub notRun " + String(skipped.length));
}
export function afterClose(problem: string): string {
  throw new Error("stub afterClose " + problem);
}
export function taskClues(question: string): string[] {
  throw new Error("stub taskClues " + question);
}
export function roundZero(question: string, tree: ScoutTree, fs: ScoutFs, skip: string[], maxChars: number): string {
  throw new Error("stub roundZero " + question + tree.root + typeof fs + String(skip.length) + String(maxChars));
}
