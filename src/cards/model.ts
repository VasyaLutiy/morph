import path from "node:path";
import type { Card, CardResult, Deck, DeckResult, Fault } from "./types.js";

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const RETRY_SUFFIX_PATTERN = /\.r[0-9]+$/;
const SCHEMA_KEYS: readonly string[] = [
  "customId",
  "intent",
  "targets",
  "contextSlice",
  "instruction",
  "acceptance",
  "model",
  "maxTokens",
  "reasoning",
  "variants",
  "dependsOn",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((e): boolean => typeof e === "string");
}

function normalizeRepoPath(p: string): string {
  let n = path.posix.normalize(p);
  while (n.startsWith("./")) n = n.slice(2);
  return n;
}

function isRepoRelative(p: string): boolean {
  const n = normalizeRepoPath(p);
  return (
    n !== "" &&
    n !== "." &&
    n !== ".." &&
    !n.startsWith("/") &&
    !n.startsWith("../")
  );
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

function isReasoning(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  if (keys.length !== 1) return false;
  if (keys[0] === "maxTokens") return isPositiveInteger(v["maxTokens"]);
  if (keys[0] === "effort") {
    const effort = v["effort"];
    return (
      effort === "low" || effort === "medium" || effort === "high"
    );
  }
  return false;
}

export function validateCard(input: unknown): CardResult {
  if (!isPlainObject(input)) {
    return { ok: false, faults: [{ key: "card", message: "card is not an object" }] };
  }
  const obj = input;
  const faults: Fault[] = [];
  const add = (key: string, message: string): void => {
    faults.push({ key, message });
  };

  // customId
  let customId: string | null = null;
  const customIdV = obj["customId"];
  if (customIdV === undefined) add("customId", "customId is required");
  else if (typeof customIdV !== "string") add("customId", "customId is not a string");
  else if (!ID_PATTERN.test(customIdV))
    add("customId", `customId '${customIdV}' does not match ^[A-Za-z0-9._-]+$`);
  else if (RETRY_SUFFIX_PATTERN.test(customIdV))
    add("customId", `customId '${customIdV}' ends in .r<n>, the suffix of a retry`);
  else customId = customIdV;

  // intent
  let intent: "generate" | "patch" | null = null;
  const intentV = obj["intent"];
  if (intentV === undefined) add("intent", "intent is required");
  else if (typeof intentV !== "string") add("intent", "intent is not a string");
  else if (intentV !== "generate" && intentV !== "patch")
    add("intent", `intent '${intentV}' is not generate|patch`);
  else intent = intentV;

  // targets
  const targets: string[] = [];
  const targetsV = obj["targets"];
  if (targetsV === undefined) add("targets", "targets is required");
  else if (!isStringList(targetsV)) add("targets", "targets is not a list of strings");
  else {
    if (targetsV.length === 0) add("targets", "targets is empty");
    const seen = new Set<string>();
    for (const p of targetsV) {
      const n = normalizeRepoPath(p);
      if (!isRepoRelative(p)) add("targets", `targets '${n}' is not repo-relative`);
      else if (seen.has(n)) add("targets", `targets repeat ${n} after normalisation`);
      else {
        seen.add(n);
        targets.push(n);
      }
    }
  }

  // contextSlice
  const contextSlice: string[] = [];
  const sliceV = obj["contextSlice"];
  if (sliceV !== undefined) {
    if (!isStringList(sliceV)) add("contextSlice", "contextSlice is not a list of strings");
    else {
      const seen = new Set<string>();
      for (const p of sliceV) {
        const n = normalizeRepoPath(p);
        if (!isRepoRelative(p)) add("contextSlice", `contextSlice '${n}' is not repo-relative`);
        else if (seen.has(n)) add("contextSlice", `contextSlice repeat ${n} after normalisation`);
        else {
          seen.add(n);
          contextSlice.push(n);
        }
      }
    }
  }

  // instruction
  let instruction: string | null = null;
  const instructionV = obj["instruction"];
  if (instructionV === undefined) add("instruction", "instruction is required");
  else if (typeof instructionV !== "string") add("instruction", "instruction is not a string");
  else if (instructionV.trim() === "") add("instruction", "instruction is empty");
  else instruction = instructionV;

  // acceptance, model
  const nullableString = (
    key: "acceptance" | "model",
    v: unknown,
  ): string | null => {
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") {
      add(key, `${key} is not a string or null`);
      return null;
    }
    return v;
  };
  const acceptance = nullableString("acceptance", obj["acceptance"]);
  const model = nullableString("model", obj["model"]);

  // maxTokens
  let maxTokens: number | null = null;
  const maxTokensV = obj["maxTokens"];
  if (maxTokensV !== undefined && maxTokensV !== null) {
    if (!isPositiveInteger(maxTokensV)) add("maxTokens", "maxTokens is not a positive integer or null");
    else maxTokens = maxTokensV;
  }

  // reasoning
  let reasoning: Card["reasoning"] = null;
  const reasoningV = obj["reasoning"];
  if (reasoningV !== undefined && reasoningV !== null) {
    if (!isReasoning(reasoningV)) add("reasoning", "reasoning is not {maxTokens} or {effort} or null");
    else reasoning = reasoningV as Card["reasoning"];
  }

  // variants
  let variants = 1;
  const variantsV = obj["variants"];
  if (variantsV !== undefined) {
    if (!isPositiveInteger(variantsV)) add("variants", "variants is not an integer >= 1");
    else variants = variantsV;
  }

  // dependsOn
  const dependsOn: string[] = [];
  const dependsOnV = obj["dependsOn"];
  if (dependsOnV !== undefined) {
    if (!isStringList(dependsOnV)) add("dependsOn", "dependsOn is not a list of strings");
    else {
      const seen = new Set<string>();
      for (const id of dependsOnV) {
        if (!ID_PATTERN.test(id)) add("dependsOn", `dependsOn '${id}' does not match ^[A-Za-z0-9._-]+$`);
        else if (seen.has(id)) add("dependsOn", `dependsOn repeat ${id}`);
        else {
          seen.add(id);
          dependsOn.push(id);
        }
      }
    }
  }

  // unknown keys, in input order
  for (const k of Object.keys(obj)) {
    if (!SCHEMA_KEYS.includes(k)) add(k, `${k} is not a Card key`);
  }

  if (faults.length > 0) return { ok: false, faults };

  const card: Card = {
    customId: customId as string,
    intent: intent as Intent,
    targets,
    contextSlice,
    instruction: instruction as string,
    acceptance,
    model,
    maxTokens,
    reasoning,
    variants,
    dependsOn,
  };
  return { ok: true, card };
}

type Intent = Card["intent"];

export function loadDeck(text: string): DeckResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      faults: [{ key: "deck", message: `deck is not valid JSON: ${message}` }],
    };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, faults: [{ key: "deck", message: "deck is not a JSON array" }] };
  }

  const faults: Fault[] = [];
  const cards: Card[] = [];
  const seenIds = new Set<string>();
  parsed.forEach((element: unknown, i: number): void => {
    const result = validateCard(element);
    if (!result.ok) {
      for (const f of result.faults) {
        faults.push({ key: `cards[${i}].${f.key}`, message: f.message });
      }
    } else {
      cards.push(result.card);
    }
    if (isPlainObject(element) && typeof element["customId"] === "string") {
      const id = element["customId"];
      if (seenIds.has(id)) {
        faults.push({ key: `cards[${i}].customId`, message: `duplicate customId ${id}` });
      } else {
        seenIds.add(id);
      }
    }
  });

  // dependsOn cycle over the valid cards: depth-first from each card in deck
  // order, following dependsOn in list order; the first back edge names it.
  const byId = new Map<string, Card>();
  for (const c of cards) byId.set(c.customId, c);
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const found: { cycle: string[] | null } = { cycle: null };
  const visit = (id: string): void => {
    if (found.cycle !== null) return;
    const s = state.get(id);
    if (s === "done") return;
    if (s === "visiting") {
      found.cycle = stack.slice(stack.indexOf(id)).concat(id);
      return;
    }
    state.set(id, "visiting");
    stack.push(id);
    const card = byId.get(id);
    if (card !== undefined) {
      for (const dep of card.dependsOn) {
        if (byId.has(dep)) visit(dep);
        if (found.cycle !== null) return;
      }
    }
    stack.pop();
    state.set(id, "done");
  };
  for (const c of cards) {
    visit(c.customId);
    if (found.cycle !== null) break;
  }
  if (found.cycle !== null) {
    faults.push({
      key: "dependsOn",
      message: `dependsOn cycle ${found.cycle.join(" -> ")}`,
    });
  }

  if (faults.length > 0) return { ok: false, faults };

  const deckIds = new Set<string>();
  for (const c of cards) deckIds.add(c.customId);
  const external: string[] = [];
  for (const c of cards) {
    for (const dep of c.dependsOn) {
      if (!deckIds.has(dep) && !external.includes(dep)) external.push(dep);
    }
  }
  const deck: Deck = { cards, externalDependsOn: external };
  return { ok: true, deck };
}
