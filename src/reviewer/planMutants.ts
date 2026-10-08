export interface MutationRule {
  from: string;
  to: string;
  word: boolean;
}

export interface Mutant {
  path: string;
  line: number;
  column: number;
  rule: string;
  text: string;
}

export const MUTATION_RULES: readonly MutationRule[] = [
  { from: "===", to: "!==", word: false },
  { from: "!==", to: "===", word: false },
  { from: " <= ", to: " < ", word: false },
  { from: " >= ", to: " > ", word: false },
  { from: " < ", to: " <= ", word: false },
  { from: " > ", to: " >= ", word: false },
  { from: " + ", to: " - ", word: false },
  { from: " - ", to: " + ", word: false },
  { from: "&&", to: "||", word: false },
  { from: "||", to: "&&", word: false },
  { from: "true", to: "false", word: true },
  { from: "false", to: "true", word: true },
];

const SKIP_LINE = /^\s*(?:\/\/|\/\*|\*|#|import\b|export\s+(?:type\s+)?\{)/;
const WORD_CHAR = /[A-Za-z0-9_$]/;

export function quotedMask(line: string): boolean[] {
  const mask: boolean[] = [];
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote === null) {
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        mask.push(true);
      } else {
        mask.push(false);
      }
    } else {
      mask.push(true);
      if (ch === "\\") {
        if (i + 1 < line.length) {
          mask.push(true);
          i++;
        }
      } else if (ch === quote) {
        quote = null;
      }
    }
  }
  return mask;
}

export function planMutants(path: string, text: string, limit: number): Mutant[] {
  if (limit <= 0) return [];
  const lines = text.split("\n");
  const all: Mutant[] = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (SKIP_LINE.test(line)) continue;
    const mask = quotedMask(line);
    let codeEnd = line.length;
    for (let i = 0; i + 1 < line.length; i++) {
      if (line[i] === "/" && line[i + 1] === "/" && !mask[i] && !mask[i + 1]) {
        codeEnd = i;
        break;
      }
    }
    const occurrences: { index: number; ruleIndex: number }[] = [];
    for (let ri = 0; ri < MUTATION_RULES.length; ri++) {
      const rule = MUTATION_RULES[ri];
      let idx = line.indexOf(rule.from);
      while (idx !== -1) {
        if (idx + rule.from.length <= codeEnd && !mask[idx]) {
          const before = idx > 0 ? line[idx - 1] : "";
          const after = idx + rule.from.length < line.length ? line[idx + rule.from.length] : "";
          if (!rule.word || (!WORD_CHAR.test(before) && !WORD_CHAR.test(after))) {
            occurrences.push({ index: idx, ruleIndex: ri });
          }
        }
        idx = line.indexOf(rule.from, idx + 1);
      }
    }
    occurrences.sort((a, b) => a.index - b.index || a.ruleIndex - b.ruleIndex);
    for (const occ of occurrences) {
      const rule = MUTATION_RULES[occ.ruleIndex];
      const offset = rule.from.length - rule.from.trimStart().length;
      const column = occ.index + offset + 1;
      const mutated = line.slice(0, occ.index) + rule.to + line.slice(occ.index + rule.from.length);
      const next = lines.slice();
      next[li] = mutated;
      all.push({
        path,
        line: li + 1,
        column,
        rule: rule.from.trim() + " \u2192 " + rule.to.trim(),
        text: next.join("\n"),
      });
    }
  }
  if (all.length <= limit) return all;
  const out: Mutant[] = [];
  for (let i = 0; i < limit; i++) {
    out.push(all[Math.floor((i * all.length) / limit)]);
  }
  return out;
}
