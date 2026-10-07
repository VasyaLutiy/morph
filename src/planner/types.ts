import type { Card } from "../cards/types.js";
import type { Component, ContourFunction, ContourMap, ContourRecord } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";

export interface Budget { maxTokens: number; reasoningMaxTokens: number; variants: number }
export interface Unit { id: string; name: string; functions: ContourFunction[]; isGroup: boolean }
export type UnitsResult = { ok: true; units: Unit[] } | { ok: false; error: string };
export interface CutInput { record: ContourRecord; component: Component; map: ContourMap; docs: string[]; spec: string }
export interface CutCard {
  card: Card; component: Component | null; profile: LanguageProfile | null;
  functions: ContourFunction[]; slicedByMap: boolean;
}
export type CutResult = { ok: true; cuts: CutCard[] } | { ok: false; error: string };
export interface JudgeInput {
  record: ContourRecord; cuts: CutCard[]; map: ContourMap; docs: string[];
  defaultProfile: LanguageProfile; hasFile: (path: string) => boolean;
}
export type OrderResult =
  | { ok: true; cards: Card[]; generations: string[][]; externalDependsOn: Record<string, string[]> }
  | { ok: false; error: string };
export interface PlanInput {
  record: ContourRecord; map: ContourMap; spec: string; components: string[]; judge: boolean;
  hasFile: (path: string) => boolean;
}
export interface Plan {
  spec: string; components: string[]; cards: Card[]; generations: string[][];
  externalDependsOn: Record<string, string[]>;
}
export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: string };
