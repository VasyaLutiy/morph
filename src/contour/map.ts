import type { CardFields, ExtraCard, MapCard, MapGroup, MapResult } from "./types.js";

export const MAP_KEYS = ["version", "package", "language", "docs", "groups", "cards", "extra_cards"] as const;
export const CARD_KEYS = ["custom_id", "intent", "targets", "context_slice", "depends_on", "instruction", "acceptance", "model", "max_tokens", "reasoning_max_tokens", "variants"] as const;
export const EXTRA_KEYS = ["component", ...CARD_KEYS] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function unknownKeys(obj: Record<string, unknown>, known: readonly string[]): string[] {
  return Object.keys(obj).filter((k) => !known.includes(k));
}

function checkCardFields(
  obj: Record<string, unknown>,
  path: string,
  problems: string[],
): CardFields {
  let customId: string | null = null;
  let intent: "generate" | "patch" | null = null;
  let targets: string[] | null = null;
  let contextSlice: string[] | null = null;
  let dependsOn: string[] | null = null;
  let instruction: string | null = null;
  let acceptance: string | null = null;
  let model: string | null = null;
  let maxTokens: number | null = null;
  let reasoningMaxTokens: number | null = null;
  let variants: number | null = null;

  for (const key of CARD_KEYS) {
    if (!(key in obj)) continue;
    const v = obj[key];
    const p = path + "." + key;
    switch (key) {
      case "custom_id":
        if (typeof v === "string" && /^[A-Za-z0-9._-]+$/.test(v)) customId = v;
        else problems.push(p + ": must match ^[A-Za-z0-9._-]+$");
        break;
      case "intent":
        if (v === "generate" || v === "patch") intent = v;
        else problems.push(p + ": must be generate or patch");
        break;
      case "targets":
      case "context_slice":
      case "depends_on": {
        if (!Array.isArray(v)) {
          problems.push(p + ": must be a list");
          break;
        }
        const list: string[] = [];
        let ok = true;
        v.forEach((item, i) => {
          if (isNonEmptyString(item)) list.push(item);
          else {
            problems.push(p + "[" + i + "]: must be a non-empty string");
            ok = false;
          }
        });
        if (key === "targets") {
          if (ok && list.length === 0) problems.push(p + ": must hold at least one path");
          targets = list;
        } else if (key === "context_slice") contextSlice = list;
        else dependsOn = list;
        break;
      }
      case "instruction":
        if (isNonEmptyString(v)) instruction = v;
        else problems.push(p + ": must be a non-empty string");
        break;
      case "acceptance":
        if (isNonEmptyString(v)) acceptance = v;
        else problems.push(p + ": must be a non-empty string");
        break;
      case "model":
        if (isNonEmptyString(v)) model = v;
        else problems.push(p + ": must be a non-empty string");
        break;
      case "max_tokens":
        if (typeof v === "number" && Number.isInteger(v) && v > 0) maxTokens = v;
        else problems.push(p + ": must be a positive integer");
        break;
      case "reasoning_max_tokens":
        if (typeof v === "number" && Number.isInteger(v) && v > 0) reasoningMaxTokens = v;
        else problems.push(p + ": must be a positive integer");
        break;
      case "variants":
        if (typeof v === "number" && Number.isInteger(v) && v > 0) variants = v;
        else problems.push(p + ": must be a positive integer");
        break;
    }
  }

  return {
    customId, intent, targets, contextSlice, dependsOn, instruction,
    acceptance, model, maxTokens, reasoningMaxTokens, variants,
  };
}

export function validateMap(doc: unknown): MapResult {
  const problems: string[] = [];

  if (!isPlainObject(doc)) {
    return { ok: false, problems: ["(root): a map must be an object"] };
  }

  for (const k of unknownKeys(doc, MAP_KEYS)) {
    problems.push("(root): unknown key '" + k + "' (known: " + MAP_KEYS.join(", ") + ")");
  }

  const version = 1;
  if ("version" in doc && doc.version !== 1) {
    problems.push("version: must be 1");
  }

  let pkg: string | null = null;
  if ("package" in doc) {
    if (isNonEmptyString(doc.package)) pkg = doc.package;
    else problems.push("package: must be a non-empty string");
  }

  let language: string | null = null;
  if ("language" in doc) {
    if (isNonEmptyString(doc.language)) language = doc.language;
    else problems.push("language: must be a non-empty string");
  }

  const docs: string[] = [];
  if ("docs" in doc) {
    const v = doc.docs;
    if (!Array.isArray(v)) problems.push("docs: must be a list");
    else {
      v.forEach((item, i) => {
        if (isNonEmptyString(item)) docs.push(item);
        else problems.push("docs[" + i + "]: must be a non-empty string");
      });
    }
  }

  const groups: MapGroup[] = [];
  if ("groups" in doc) {
    const v = doc.groups;
    if (!isPlainObject(v)) problems.push("groups: must be an object");
    else {
      const seen = new Map<string, string>();
      for (const g of Object.keys(v)) {
        const members = v[g];
        if (!Array.isArray(members) || members.length === 0) {
          problems.push("groups." + g + ": must be a non-empty list of Function names");
          continue;
        }
        const functions: string[] = [];
        members.forEach((m, i) => {
          if (!isNonEmptyString(m)) {
            problems.push("groups." + g + "[" + i + "]: must be a non-empty string");
            return;
          }
          const first = seen.get(m);
          if (first !== undefined) {
            problems.push("groups." + g + "[" + i + "]: Function '" + m + "' is already in group '" + first + "'");
          } else {
            seen.set(m, g);
          }
          functions.push(m);
        });
        groups.push({ name: g, functions });
      }
    }
  }

  const cards: MapCard[] = [];
  if ("cards" in doc) {
    const v = doc.cards;
    if (!isPlainObject(v)) problems.push("cards: must be an object");
    else {
      for (const id of Object.keys(v)) {
        const override = v[id];
        if (!isPlainObject(override)) {
          problems.push("cards." + id + ": must be an object");
          continue;
        }
        for (const k of unknownKeys(override, CARD_KEYS)) {
          problems.push("cards." + id + ": unknown key '" + k + "' (known: " + CARD_KEYS.join(", ") + ")");
        }
        const fields = checkCardFields(override, "cards." + id, problems);
        cards.push({ id, ...fields });
      }
    }
  }

  const extraCards: ExtraCard[] = [];
  if ("extra_cards" in doc) {
    const v = doc.extra_cards;
    if (!Array.isArray(v)) problems.push("extra_cards: must be a list");
    else {
      v.forEach((item, i) => {
        const base = "extra_cards[" + i + "]";
        if (!isPlainObject(item)) {
          problems.push(base + ": must be an object");
          return;
        }
        for (const key of ["custom_id", "targets", "instruction"] as const) {
          if (!(key in item)) problems.push(base + "." + key + ": required");
        }
        for (const k of unknownKeys(item, EXTRA_KEYS)) {
          problems.push(base + ": unknown key '" + k + "' (known: " + EXTRA_KEYS.join(", ") + ")");
        }
        let component: string | null = null;
        if ("component" in item) {
          if (isNonEmptyString(item.component)) component = item.component;
          else problems.push(base + ".component: must be a non-empty string");
        }
        const fields = checkCardFields(item, base, problems);
        extraCards.push({ component, ...fields });
      });
    }
  }

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    map: { version, package: pkg, language, docs, groups, cards, extraCards },
  };
}
