export type StepVerb = "calls" | "reads" | "modifies" | "produces" | "uses";
export interface Step { verb: StepVerb; target: string }
export interface Example { given: string; when: string; then: string; ref: string | null }
export interface ContourFunction {
  name: string; description: string; behavior: string;
  requirements: string[]; guardrails: string[]; preconditions: string[];
  steps: Step[]; examples: Example[];
}
export interface DataObject { name: string; description: string; schema: string | null }
export interface ContourInterface { name: string; description: string; exposes: string[] }
export interface Component {
  name: string; description: string; language: string | null;
  requirements: string[]; guardrails: string[];
  functions: ContourFunction[]; dataObjects: DataObject[]; interfaces: ContourInterface[];
}
export interface ContourSystem {
  name: string; description: string; requirements: string[]; guardrails: string[]; groups: Component[];
}
export interface Definition { name: string; description: string }
export interface Actor { name: string; description: string; uses: string[] }
export interface ContourRecord {
  version: 1; system: ContourSystem; actors: Actor[]; requirements: Definition[]; guardrails: Definition[];
}
export type RecordResult = { ok: true; record: ContourRecord } | { ok: false; problems: string[] };
export interface CardFields {
  customId: string | null; intent: "generate" | "patch" | null; targets: string[] | null;
  contextSlice: string[] | null; dependsOn: string[] | null; instruction: string | null;
  acceptance: string | null; model: string | null; maxTokens: number | null;
  reasoningMaxTokens: number | null; variants: number | null;
}
export interface MapCard extends CardFields { id: string }
export interface ExtraCard extends CardFields { component: string | null }
export interface MapGroup { name: string; functions: string[] }
export interface ContourMap {
  version: 1; package: string | null; language: string | null; docs: string[];
  groups: MapGroup[]; cards: MapCard[]; extraCards: ExtraCard[];
}
export type MapResult = { ok: true; map: ContourMap } | { ok: false; problems: string[] };
export type DocResult = { ok: true; doc: Record<string, unknown> } | { ok: false, error: string };
export type LoadRecordResult = { ok: true; record: ContourRecord } | { ok: false; error: string };
export type LoadMapResult = { ok: true; map: ContourMap } | { ok: false; error: string };
export type SelectResult = { ok: true; components: Component[] } | { ok: false; error: string };
export interface FunctionLink { function: string; calls: string[]; dataObjects: string[]; uses: string[] }
export type LinksResult = { ok: true; links: FunctionLink[] } | { ok: false; errors: string[] };
