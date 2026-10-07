import type { CheckCard, Checks, ChecksResult, JudgeFile } from "./types.js";

export const DEFAULT_FROZEN: string[] = [
  "contour.yaml",
  "morph-map.json",
  "docs",
  "decks",
  "tests/fixtures",
];

const ID_RE = /^[A-Za-z0-9._-]+$/;

const ROOT_KEYS: readonly string[] = ["version", "phase", "parts", "frozen", "fullExclude", "ownGit", "cards"];
const CARD_KEYS: readonly string[] = ["id", "smoke", "extra", "files"];
const FILE_KEYS: readonly string[] = ["file", "min", "max", "lits", "drop", "new"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function has(obj: Record<string, unknown>, key: string): boolean {
  return key in obj && obj[key] !== undefined && obj[key] !== null;
}

function unknownKeys(
  obj: Record<string, unknown>,
  known: readonly string[],
  path: string,
  problems: string[],
): void {
  const table = known.join(", ");
  for (const k of Object.keys(obj)) {
    if (!known.includes(k)) {
      problems.push(`${path}: unknown key '${k}' (known: ${table})`);
    }
  }
}

function nonEmptyString(prefix: string, key: string, v: unknown, problems: string[]): string | null {
  if (typeof v !== "string" || v.length === 0) {
    problems.push(`${prefix}${key}: must be a non-empty string`);
    return null;
  }
  return v;
}

function stringList(prefix: string, key: string, v: unknown, problems: string[]): string[] | null {
  if (!Array.isArray(v)) {
    problems.push(`${prefix}${key}: must be a list`);
    return null;
  }
  const out: string[] = [];
  let ok = true;
  for (let j = 0; j < v.length; j++) {
    const item: unknown = v[j];
    if (typeof item !== "string" || item.length === 0) {
      problems.push(`${prefix}${key}[${j}]: must be a non-empty string`);
      ok = false;
    } else {
      out.push(item);
    }
  }
  return ok ? out : null;
}

function integer(
  prefix: string,
  key: string,
  v: unknown,
  problems: string[],
  positive: boolean,
): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || (positive ? v < 1 : v < 0)) {
    problems.push(`${prefix}${key}: must be a ${positive ? "positive" : "non-negative"} integer`);
    return null;
  }
  return v;
}

function checkFile(obj: Record<string, unknown>, path: string, problems: string[]): JudgeFile | null {
  unknownKeys(obj, FILE_KEYS, path, problems);
  const prefix = `${path}.`;
  let file: string | null = null;
  if (!has(obj, "file")) {
    problems.push(`${prefix}file: required`);
  } else {
    file = nonEmptyString(prefix, "file", obj.file, problems);
  }
  let min: number | null = null;
  if (!has(obj, "min")) {
    problems.push(`${prefix}min: required`);
  } else {
    min = integer(prefix, "min", obj.min, problems, false);
  }
  let max: number | null = null;
  if (!has(obj, "max")) {
    problems.push(`${prefix}max: required`);
  } else {
    max = integer(prefix, "max", obj.max, problems, false);
  }
  let lits: string[] | null = [];
  if (has(obj, "lits")) {
    lits = stringList(prefix, "lits", obj.lits, problems);
  }
  let drop: string[] | null = [];
  if (has(obj, "drop")) {
    drop = stringList(prefix, "drop", obj.drop, problems);
  }
  let isNew = false;
  if (has(obj, "new")) {
    if (typeof obj.new !== "boolean") {
      problems.push(`${prefix}new: must be true or false`);
    } else {
      isNew = obj.new;
    }
  }
  if (min !== null && max !== null && min > max) {
    problems.push(`${path}: min ${min} exceeds max ${max}`);
  }
  if (file !== null && min !== null && max !== null && lits !== null && drop !== null) {
    return { file, min, max, lits, drop, new: isNew };
  }
  return null;
}

export function validateChecks(doc: unknown): ChecksResult {
  const problems: string[] = [];
  if (!isPlainObject(doc)) {
    return { ok: false, problems: ["(root): checks must be an object"] };
  }
  const root: Record<string, unknown> = doc;
  unknownKeys(root, ROOT_KEYS, "(root)", problems);

  if (has(root, "version") && root.version !== 1) {
    problems.push("version: must be 1");
  }

  let phase: string | null = null;
  if (!has(root, "phase")) {
    problems.push("phase: required");
  } else if (typeof root.phase !== "string" || !ID_RE.test(root.phase)) {
    problems.push("phase: must match ^[A-Za-z0-9._-]+$");
  } else {
    phase = root.phase;
  }

  let parts: string | null = null;
  if (has(root, "parts")) {
    parts = nonEmptyString("", "parts", root.parts, problems);
  }

  let frozen: string[] | null = null;
  if (has(root, "frozen")) {
    frozen = stringList("", "frozen", root.frozen, problems);
  }

  let fullExclude: string[] | null = null;
  if (has(root, "fullExclude")) {
    fullExclude = stringList("", "fullExclude", root.fullExclude, problems);
  }

  let ownGit = false;
  if (has(root, "ownGit")) {
    if (typeof root.ownGit !== "boolean") {
      problems.push("ownGit: must be true or false");
    } else {
      ownGit = root.ownGit;
    }
  }

  const cardsRaw: unknown = root.cards;
  if (!has(root, "cards")) {
    problems.push("cards: required");
  } else if (!Array.isArray(cardsRaw) || cardsRaw.length === 0) {
    problems.push("cards: must be a non-empty list");
  }

  const outCards: CheckCard[] = [];
  const seen: Set<string> = new Set();
  if (Array.isArray(cardsRaw)) {
    for (let i = 0; i < cardsRaw.length; i++) {
      const c: unknown = cardsRaw[i];
      const cpath = `cards[${i}]`;
      if (!isPlainObject(c)) {
        problems.push(`${cpath}: must be an object`);
        continue;
      }
      unknownKeys(c, CARD_KEYS, cpath, problems);
      const prefix = `${cpath}.`;

      let id: string | null = null;
      if (!has(c, "id")) {
        problems.push(`${cpath}.id: required`);
      } else if (typeof c.id !== "string" || !ID_RE.test(c.id)) {
        problems.push(`${cpath}.id: must match ^[A-Za-z0-9._-]+$`);
      } else {
        id = c.id;
        if (seen.has(id)) {
          problems.push(`${cpath}.id: duplicate id '${id}'`);
        } else {
          seen.add(id);
        }
      }

      let smoke: number | null = null;
      if (has(c, "smoke")) {
        const s = integer(prefix, "smoke", c.smoke, problems, true);
        if (s !== null) {
          smoke = s;
        }
      }

      let extra: string | null = null;
      if (has(c, "extra")) {
        extra = nonEmptyString(prefix, "extra", c.extra, problems);
      }

      const filesPresent = has(c, "files");
      let files: JudgeFile[] | null = null;
      if (filesPresent) {
        const f: unknown = c.files;
        if (!Array.isArray(f) || f.length === 0) {
          problems.push(`${cpath}.files: must be a non-empty list`);
        } else {
          const jfs: JudgeFile[] = [];
          for (let j = 0; j < f.length; j++) {
            const fj: unknown = f[j];
            const fpath = `${cpath}.files[${j}]`;
            if (!isPlainObject(fj)) {
              problems.push(`${fpath}: must be an object`);
              continue;
            }
            const jf = checkFile(fj, fpath, problems);
            if (jf !== null) {
              jfs.push(jf);
            }
          }
          if (jfs.length === f.length) {
            files = jfs;
          }
        }
      }

      if (filesPresent && (has(c, "smoke") || has(c, "extra"))) {
        problems.push(`${cpath}: a judge card (files) takes no smoke or extra`);
      }

      outCards.push({ id: id ?? "", smoke, extra, files });
    }
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  const checks: Checks = {
    version: 1,
    phase: phase ?? "",
    parts: parts ?? `decks/${phase ?? ""}/parts`,
    frozen: frozen ?? DEFAULT_FROZEN.slice(),
    fullExclude: fullExclude ?? [],
    ownGit,
    cards: outCards,
  };
  return { ok: true, checks };
}
