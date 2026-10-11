// The markdown a fresh session reads: one Document, its sections and line
// formats fixed, one cut at the cap. Pure: nothing is imported.

export interface DigestTotals {
  runs: number;
  v2: { runs: number; cards: number; written: number; cost: number };
  mrph: { runs: number; cards: number; written: number; cost: number };
  cards: number;
  written: number;
  failed: number;
  skipped: number;
  requests: number;
  answers: number;
  cost: number;
  unpriced: number;
  models: { model: string; runs: number }[];
  from: string;
  to: string;
}

export interface DigestLine {
  phase: string;
  date: string;
  builder: string;
  models: string[];
  written: number | null;
  planned: number | null;
  runs: number;
  notes: string;
  cost: string;
  switches: string[];
}

export interface DigestStory {
  chronology: DigestLine[];
  next: { phase: string | null; row: string | null; handoff: string[] };
  decisions: string[];
  issues: {
    state: "read" | "absent" | "unreadable";
    items: { number: number; title: string; labels: string[] }[];
  };
  missing: string[];
}

export interface DigestOwnership {
  commits: number;
  models: { model: string; commits: number }[];
  paths: { path: string; writes: { card: string; model: string; run: string | null }[] }[];
}

export interface PrimerDigest {
  name: string;
  generatedAt: string;
  files: number;
  tests: { language: string; files: number; tests: number };
  runs: { skipped: { dir: string; reason: string }[]; totals: DigestTotals };
  story: DigestStory;
  ownership: DigestOwnership;
  running: string | null;
}

export const OWNERSHIP_PATHS = 30;
export const OWNERSHIP_WRITES = 3;

export function renderPrimer(digest: PrimerDigest, cap: number): string {
  const md = buildPrimer(digest);
  if (md.length > cap) {
    const head = md.slice(0, cap - 60);
    return head.slice(0, head.lastIndexOf("\n") + 1) + `_… truncated to fit ${cap} chars_\n`;
  }
  return md;
}

const MIDDLE = "·";
const ARROW = "→";
const DASH = "—";

function missingPath(key: string): string {
  switch (key) {
    case "measure":
      return "docs/MEASURE.md";
    case "plan":
      return "docs/PLAN.md";
    case "autonomy":
      return "docs/AUTONOMY.md";
    case "decisions":
      return "docs/DECISIONS.md";
    default:
      return key;
  }
}

function runsWord(count: number): string {
  return count === 1 ? "run" : "runs";
}

function buildPrimer(digest: PrimerDigest): string {
  const lines: string[] = [];

  lines.push(`# Primer: ${digest.name}`);
  lines.push("");
  lines.push(
    `generated ${digest.generatedAt} ${MIDDLE} ${digest.files} files in the tree ${MIDDLE} no model call, no network`,
  );
  if (digest.story.missing.length > 0) {
    lines.push(`missing: ${digest.story.missing.map(missingPath).join(", ")}`);
  }
  lines.push("");

  lines.push("## Tests");
  lines.push("");
  lines.push(
    `- ${digest.tests.tests} tests in ${digest.tests.files} test files by the ${digest.tests.language} profile (counted from text, not a run)`,
  );
  lines.push("");

  lines.push("## Runs");
  lines.push("");
  lines.push(...runsLines(digest.runs.totals, digest.runs.skipped));
  lines.push(...noteLines(digest));
  lines.push("");

  lines.push("## Chronology (docs/MEASURE.md)");
  lines.push("");
  lines.push(...chronologyLines(digest.story.chronology));
  lines.push("");

  lines.push("## File ownership (git, Morph-Card trailers)");
  lines.push("");
  lines.push(...ownershipLines(digest.ownership));
  lines.push("");

  lines.push("## What is next");
  lines.push("");
  lines.push(...nextLines(digest.story.next));
  lines.push("");

  lines.push("## Last decisions (docs/DECISIONS.md)");
  lines.push("");
  lines.push(...decisionLines(digest.story.decisions));
  lines.push("");

  lines.push("## Open issues (.morph/issues.json)");
  lines.push("");
  lines.push(...issueLines(digest.story.issues));

  return lines.join("\n") + "\n";
}

function runsLines(
  totals: DigestTotals,
  skipped: { dir: string; reason: string }[],
): string[] {
  const lines: string[] = [];
  if (totals.runs === 0) {
    lines.push("- archived runs: 0");
  } else {
    lines.push(
      `- archived runs: ${totals.runs} (V2 ${totals.v2.runs}, mrph ${totals.mrph.runs}), ${totals.from} ${ARROW} ${totals.to}`,
    );
    lines.push(
      `- cards: ${totals.written} written of ${totals.cards} (${totals.failed} failed, ${totals.skipped} skipped); requests ${totals.requests}, answers kept ${totals.answers}`,
    );
    lines.push(
      `- cost: $${totals.cost.toFixed(4)} over ${totals.runs - totals.unpriced} priced runs (${totals.unpriced} unpriced)`,
    );
    lines.push(
      `- by format: V2 ${totals.v2.runs} runs, ${totals.v2.written}/${totals.v2.cards} written, $${totals.v2.cost.toFixed(4)}; mrph ${totals.mrph.runs} runs, ${totals.mrph.written}/${totals.mrph.cards} written, $${totals.mrph.cost.toFixed(4)}`,
    );
    lines.push(
      `- models: ${totals.models
        .map((m) => `${m.model} (${m.runs} ${runsWord(m.runs)})`)
        .join(", ")}`,
    );
  }
  if (skipped.length > 0) {
    lines.push(`- skipped: ${skipped.map((s) => `${s.dir} (${s.reason})`).join(", ")}`);
  }
  return lines;
}

function noteLines(digest: PrimerDigest): string[] {
  const lines: string[] = [];
  const debts = digest.story.chronology.filter((line) => /\bdebt\b/i.test(line.phase));
  if (debts.length === 0) {
    lines.push("- debt rows (docs/MEASURE.md): none");
  } else {
    lines.push(
      "- debt rows (docs/MEASURE.md), not in these totals: " +
        debts.map((d) => `${d.phase} $${d.cost === "" ? DASH : d.cost}`).join(", "),
    );
  }
  if (digest.running === null) {
    lines.push("- running total (docs/MEASURE.md): none");
  } else {
    let text = `- running total (docs/MEASURE.md): "${digest.running}" vs $${digest.runs.totals.cost.toFixed(4)} archived here`;
    const match = /\$(\d+(?:\.\d+)?)/.exec(digest.running);
    if (match !== null) {
      text += `, difference ${(Number(match[1]) - digest.runs.totals.cost).toFixed(4)}`;
    }
    text +=
      " — the two differ by runs made outside this repository (in MEASURE, no archive here) and archived runs MEASURE's total leaves out; debt rows are in neither";
    lines.push(text);
  }
  return lines;
}

function chronologyLines(chronology: DigestLine[]): string[] {
  if (chronology.length === 0) {
    return ["- no rows"];
  }
  const lines: string[] = ["phase · date · builder · models · written/planned · runs · $ · notes"];
  for (const line of chronology) {
    const date = line.date === "" ? DASH : line.date;
    const builder = line.builder === "" ? DASH : line.builder;
    const models = line.models.length === 0 ? DASH : line.models.join(", ");
    const written =
      line.written === null
        ? DASH
        : `${line.written}/${line.planned === null ? DASH : line.planned} written`;
    let text =
      `- ${line.phase} ${MIDDLE} ${date} ${MIDDLE} ${builder} ${MIDDLE} ${models} ${MIDDLE} ` +
      `${written} ${MIDDLE} ${line.runs} ${runsWord(line.runs)} ${MIDDLE} $${line.cost === "" ? DASH : line.cost}`;
    if (line.notes !== "") {
      text += ` ${MIDDLE} ${line.notes}`;
    }
    if (line.switches.length > 0) {
      text += ` ← switch: ${line.switches.join("; ")}`;
    }
    lines.push(text);
  }
  return lines;
}

function ownershipLines(ownership: DigestOwnership): string[] {
  if (ownership.commits === 0) {
    return ["- git carries 0 Morph commits"];
  }
  const commitWord = ownership.commits === 1 ? "commit" : "commits";
  const models = ownership.models
    .map((m) => `${m.model === "" ? DASH : m.model} ${m.commits}`)
    .join(", ");
  const pathWord = ownership.paths.length === 1 ? "path" : "paths";
  const lines: string[] = [
    `- git carries ${ownership.commits} Morph ${commitWord}: ${models}`,
    `- ${ownership.paths.length} ${pathWord} written by cards, most recent first; per path its cards, newest first:`,
  ];
  for (const entry of ownership.paths.slice(0, OWNERSHIP_PATHS)) {
    const shown = entry.writes
      .slice(0, OWNERSHIP_WRITES)
      .map(
        (w) =>
          `${w.card} (${w.model === "" ? DASH : w.model}, run ${w.run === null ? DASH : w.run})`,
      )
      .join("; ");
    let text = `- ${entry.path} ← ${shown}`;
    if (entry.writes.length > OWNERSHIP_WRITES) {
      text += `; … ${entry.writes.length - OWNERSHIP_WRITES} more`;
    }
    lines.push(text);
  }
  if (ownership.paths.length > OWNERSHIP_PATHS) {
    lines.push(`- … ${ownership.paths.length - OWNERSHIP_PATHS} more paths`);
  }
  return lines;
}

function nextLines(next: DigestStory["next"]): string[] {
  const lines: string[] = [];
  if (next.row === null) {
    lines.push("- next phase: none open (docs/PLAN.md)");
  } else {
    lines.push(`- next phase (docs/PLAN.md): ${next.row}`);
  }
  if (next.handoff.length === 0) {
    lines.push('- handoff: no "## State at handoff" section (docs/AUTONOMY.md)');
  } else {
    lines.push("- handoff (docs/AUTONOMY.md):");
    for (const line of next.handoff) {
      lines.push(`  > ${line}`);
    }
  }
  return lines;
}

function decisionLines(decisions: string[]): string[] {
  if (decisions.length === 0) {
    return ["- none"];
  }
  return decisions.map((d) => `- ${d}`);
}

function issueLines(issues: DigestStory["issues"]): string[] {
  if (issues.state === "absent") {
    return [
      "- not read: no .morph/issues.json (the primer makes no network call; `gh issue list --state open --json number,title,labels > .morph/issues.json` writes it)",
    ];
  }
  if (issues.state === "unreadable") {
    return ["- not read: .morph/issues.json is not a JSON array"];
  }
  if (issues.items.length === 0) {
    return ["- none open"];
  }
  return issues.items.map((item) => {
    let text = `- #${item.number} ${item.title}`;
    if (item.labels.length > 0) {
      text += ` [${item.labels.join(", ")}]`;
    }
    return text;
  });
}
