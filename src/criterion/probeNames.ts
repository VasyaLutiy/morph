import { nameWords } from "../language/naming.js";
import type { LanguageProfile } from "../language/types.js";

export interface ExampleCount {
  name: string;
  count: number;
}

export interface ProbeTitle {
  function: string;
  n: number;
}

export interface ProbeNamesInput {
  id: string;
  path: string;
  profile: LanguageProfile;
  text: string;
  own: ExampleCount[];
  record: ExampleCount[];
  strict: boolean;
}

const TS_LINE = /^[ \t]*(?:test|it)\(\s*(["'`])(.*?)\1/;
const TS_TITLE = /^(.+) example (\d+)(?::.*)?$/;
const GO_LINE = /^func TestProbe([A-Za-z0-9_]+)Example(\d+)\(/;

export function pascalName(name: string): string {
  return nameWords(name)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export function probeTitles(profile: LanguageProfile, text: string, names: readonly string[]): ProbeTitle[] {
  const titles: ProbeTitle[] = [];
  for (const line of text.split("\n")) {
    if (profile.id === "go") {
      const m = GO_LINE.exec(line);
      if (m === null) {
        continue;
      }
      const capture = m[1];
      let fn = capture;
      for (const name of names) {
        if (pascalName(name).toLowerCase() === capture.toLowerCase()) {
          fn = name;
          break;
        }
      }
      titles.push({ function: fn, n: Number(m[2]) });
    } else {
      const opened = TS_LINE.exec(line);
      if (opened === null) {
        continue;
      }
      const m = TS_TITLE.exec(opened[2]);
      if (m === null) {
        continue;
      }
      titles.push({ function: m[1], n: Number(m[2]) });
    }
  }
  return titles;
}

export function checkProbeNames(input: ProbeNamesInput): string[] {
  const names = [...input.record.map((e) => e.name), ...input.own.map((e) => e.name)];
  const titles = probeTitles(input.profile, input.text, names);

  const seen = new Set<string>();
  const unique: ProbeTitle[] = [];
  for (const t of titles) {
    const key = `${t.function}\u0000${t.n}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }

  const ownCounts = new Map<string, number>();
  for (const e of input.own) {
    ownCounts.set(e.name, e.count);
  }
  const recordCounts = new Map<string, number>();
  for (const e of input.record) {
    recordCounts.set(e.name, e.count);
  }

  const lacks: string[] = [];
  if (input.strict) {
    for (const e of input.own) {
      const given = new Set<number>();
      for (const t of unique) {
        if (t.function === e.name) {
          given.add(t.n);
        }
      }
      const missing: number[] = [];
      for (let n = 1; n <= e.count; n++) {
        if (!given.has(n)) {
          missing.push(n);
        }
      }
      if (missing.length > 0) {
        lacks.push(
          `card '${input.id}': probe ${input.path} lacks ${e.name} example ${missing.join(", ")} (the record gives ${e.count})`,
        );
      }
    }
  }

  const groups = new Map<string, number[]>();
  const order: string[] = [];
  for (const t of unique) {
    if (input.strict) {
      const own = ownCounts.get(t.function);
      if (own !== undefined && t.n >= 1 && t.n <= own) {
        continue;
      }
    } else {
      const rec = recordCounts.get(t.function);
      if (rec !== undefined && t.n >= 1 && t.n <= rec) {
        continue;
      }
    }
    let arr = groups.get(t.function);
    if (arr === undefined) {
      arr = [];
      groups.set(t.function, arr);
      order.push(t.function);
    }
    if (!arr.includes(t.n)) {
      arr.push(t.n);
    }
  }

  const ownNames = input.own.map((e) => e.name).join(", ");
  const nameLines: string[] = [];
  for (const fn of order) {
    const grouped = groups.get(fn);
    const ns = grouped === undefined ? [] : grouped.slice().sort((a, b) => a - b);
    if (input.strict) {
      nameLines.push(
        `card '${input.id}': probe ${input.path} names ${fn} example ${ns.join(", ")}, not an example of its Functions (${ownNames === "" ? "none" : ownNames})`,
      );
    } else {
      nameLines.push(
        `card '${input.id}': probe ${input.path} names ${fn} example ${ns.join(", ")}, which the record does not give`,
      );
    }
  }

  return [...lacks, ...nameLines];
}
