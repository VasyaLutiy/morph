export interface Finding {
  kind: string;
  source: string;
  path: string | null;
  expected: string;
  got: string;
}

export interface NumberedFinding extends Finding {
  id: string;
}

export interface ChangedRow {
  path: string;
  status: string;
  added: number | null;
  deleted: number | null;
  writers: string[];
  scope: string | null;
}

export interface ObligationRow {
  component: string;
  function: string;
  touchedBy: string[];
  examples: number;
  missing: number[];
}

export interface GuardrailRow {
  name: string;
  files: number;
  findings: number;
}

export interface MutantRow {
  path: string;
  line: number;
  rule: string;
  killed: boolean;
}

export interface RenderInput {
  base: string;
  head: string;
  changed: ChangedRow[];
  obligations: ObligationRow[];
  guardrails: GuardrailRow[];
  mutants: MutantRow[] | null;
  findings: Finding[];
}

export interface ReviewCounts {
  files: number;
  obligations: number;
  examples: number;
  missing: number;
  mutants: number | null;
  killed: number | null;
  findings: number;
  byKind: Record<string, number>;
}

export interface Review {
  range: string;
  verdict: "clean" | "findings";
  counts: ReviewCounts;
  findings: NumberedFinding[];
  markdown: string;
}

export const KIND_ORDER = [
  "obligation",
  "envelope",
  "scope",
  "guardrail",
  "mutation",
] as const;

const DASH = "\u2014";
const DOT = "\u00b7";

function kindRank(kind: string): number {
  for (let i = 0; i < KIND_ORDER.length; i += 1) {
    if (KIND_ORDER[i] === kind) return i;
  }
  return KIND_ORDER.length;
}

function tableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function joined(values: readonly string[]): string {
  if (values.length === 0) return DASH;
  return values.map(tableCell).join(", ");
}

export function orderFindings(findings: readonly Finding[]): NumberedFinding[] {
  const entries = findings.map((finding, index) => ({ finding, index }));
  entries.sort((a, b) => {
    const rankA = kindRank(a.finding.kind);
    const rankB = kindRank(b.finding.kind);
    if (rankA !== rankB) return rankA - rankB;
    return a.index - b.index;
  });
  return entries.map((entry, i) => ({ id: "F" + (i + 1), ...entry.finding }));
}

export function renderFindings(input: RenderInput): Review {
  const ordered = orderFindings(input.findings);
  const range = input.base + ".." + input.head;

  const byKind: Record<string, number> = {};
  for (const kind of KIND_ORDER) {
    byKind[kind] = 0;
  }
  for (const finding of input.findings) {
    byKind[finding.kind] = (byKind[finding.kind] ?? 0) + 1;
  }

  const examples = input.obligations.reduce((sum, o) => sum + o.examples, 0);
  const missing = input.obligations.reduce((sum, o) => sum + o.missing.length, 0);
  const killed =
    input.mutants === null ? null : input.mutants.filter((m) => m.killed).length;

  const counts: ReviewCounts = {
    files: input.changed.length,
    obligations: input.obligations.length,
    examples,
    missing,
    mutants: input.mutants === null ? null : input.mutants.length,
    killed,
    findings: input.findings.length,
    byKind,
  };

  const verdict: "clean" | "findings" =
    input.findings.length === 0 ? "clean" : "findings";

  const lines: string[] = [];

  lines.push("# Review " + range);
  lines.push("");
  if (input.findings.length === 0) {
    lines.push("Clean: no findings.");
  } else {
    const parts = Object.keys(byKind).map(
      (kind) => kind + " " + (byKind[kind] ?? 0),
    );
    lines.push(input.findings.length + " findings: " + parts.join(", ") + ".");
  }
  lines.push("");

  lines.push("## Changed files (" + input.changed.length + ")");
  lines.push("");
  lines.push("| file | status | lines | written by | scope |");
  lines.push("|---|---|---|---|---|");
  for (const row of input.changed) {
    const lineCount =
      row.added === null || row.deleted === null
        ? "binary"
        : "+" + row.added + " -" + row.deleted;
    const scope = row.scope === null ? DASH : tableCell(row.scope);
    lines.push(
      "| " +
        tableCell(row.path) +
        " | " +
        tableCell(row.status) +
        " | " +
        lineCount +
        " | " +
        joined(row.writers) +
        " | " +
        scope +
        " |",
    );
  }
  lines.push("");

  lines.push(
    "## Obligations (" +
      input.obligations.length +
      " Functions, " +
      examples +
      " examples, " +
      missing +
      " missing)",
  );
  lines.push("");
  if (input.obligations.length > 0) {
    lines.push("| Function | touched by | examples | missing |");
    lines.push("|---|---|---|---|");
    for (const obligation of input.obligations) {
      const name = tableCell(
        obligation.component + " " + DOT + " " + obligation.function,
      );
      const missingCell =
        obligation.missing.length === 0 ? DASH : obligation.missing.join(", ");
      lines.push(
        "| " +
          name +
          " | " +
          joined(obligation.touchedBy) +
          " | " +
          obligation.examples +
          " | " +
          missingCell +
          " |",
      );
    }
    lines.push("");
  }

  lines.push("## Guardrails");
  lines.push("");
  lines.push("| guardrail | files | findings |");
  lines.push("|---|---|---|");
  for (const guardrail of input.guardrails) {
    lines.push(
      "| " +
        tableCell(guardrail.name) +
        " | " +
        guardrail.files +
        " | " +
        guardrail.findings +
        " |",
    );
  }
  lines.push("");

  if (input.mutants !== null) {
    lines.push(
      "## Mutants (" + (killed ?? 0) + " of " + input.mutants.length + " killed)",
    );
    lines.push("");
    if (input.mutants.length > 0) {
      lines.push("| at | rule | result |");
      lines.push("|---|---|---|");
      for (const mutant of input.mutants) {
        lines.push(
          "| " +
            tableCell(mutant.path + ":" + mutant.line) +
            " | " +
            tableCell(mutant.rule) +
            " | " +
            (mutant.killed ? "killed" : "survived") +
            " |",
        );
      }
      lines.push("");
    }
  }

  lines.push("## Findings");
  lines.push("");
  if (ordered.length === 0) {
    lines.push("None.");
    lines.push("");
  } else {
    for (const finding of ordered) {
      lines.push(
        "### " +
          finding.id +
          " " +
          DOT +
          " " +
          finding.kind +
          " " +
          DOT +
          " " +
          finding.source,
      );
      lines.push("");
      lines.push("- path: " + (finding.path === null ? DASH : finding.path));
      lines.push("- EXPECTED: " + finding.expected);
      lines.push("- GOT: " + finding.got);
      lines.push("");
    }
  }

  const markdown = lines.join("\n");

  return { range, verdict, counts, findings: ordered, markdown };
}
