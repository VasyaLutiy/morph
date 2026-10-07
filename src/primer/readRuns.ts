export interface RunArchive {
  dir: string;
  report: string | null;
  answers: number;
}

export interface RunSummary {
  runId: string;
  format: "v2" | "mrph";
  date: string;
  processor: string;
  models: string[];
  cards: number;
  written: number;
  failed: number;
  skipped: number;
  requests: number;
  cost: number | null;
  answers: number;
}

export interface FormatTotals {
  runs: number;
  cards: number;
  written: number;
  cost: number;
}

export interface RunsTotals {
  runs: number;
  v2: FormatTotals;
  mrph: FormatTotals;
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

export interface RunsDigest {
  runs: RunSummary[];
  skipped: { dir: string; reason: string }[];
  totals: RunsTotals;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateOf(runId: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})-/.exec(runId);
  if (match === null) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function modelsOf(rows: unknown[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isObject(row)) continue;
    const model = asString(row.model);
    if (model !== null) seen.add(model);
  }
  return Array.from(seen).sort();
}

function outcomeCounts(outcomes: unknown[]): { written: number; failed: number; skipped: number } {
  let written = 0;
  let failed = 0;
  let skipped = 0;
  for (const outcome of outcomes) {
    if (!isObject(outcome)) continue;
    if (outcome.status === "written") written += 1;
    else if (outcome.status === "failed") failed += 1;
    else if (outcome.status === "skipped") skipped += 1;
  }
  return { written, failed, skipped };
}

export function readRuns(archives: RunArchive[]): RunsDigest {
  const sorted = archives
    .slice()
    .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));

  const runs: RunSummary[] = [];
  const skipped: { dir: string; reason: string }[] = [];

  for (const archive of sorted) {
    if (archive.report === null) {
      skipped.push({ dir: archive.dir, reason: "no report.json" });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(archive.report);
    } catch {
      skipped.push({ dir: archive.dir, reason: "report.json is not a JSON object" });
      continue;
    }
    if (!isObject(parsed)) {
      skipped.push({ dir: archive.dir, reason: "report.json is not a JSON object" });
      continue;
    }

    const runIdValue = parsed.runId;
    const outcomesValue = parsed.outcomes;
    const deckIdValue = parsed.deck_id;

    if (typeof runIdValue === "string" && Array.isArray(outcomesValue)) {
      const rows = Array.isArray(parsed.requests) ? parsed.requests : [];
      const usageTotals = isObject(parsed.usageTotals) ? parsed.usageTotals : {};
      const counts = outcomeCounts(outcomesValue);
      runs.push({
        runId: runIdValue,
        format: "v2",
        date: dateOf(runIdValue),
        processor: asString(parsed.processor) ?? "",
        models: modelsOf(rows),
        cards: outcomesValue.length,
        written: counts.written,
        failed: counts.failed,
        skipped: counts.skipped,
        requests: asFiniteNumber(usageTotals.requests) ?? rows.length,
        cost: asFiniteNumber(usageTotals.cost),
        answers: archive.answers,
      });
    } else if (typeof deckIdValue === "string" && isObject(outcomesValue)) {
      const rows = isObject(parsed.usage) ? Object.values(parsed.usage) : [];
      const usageTotals = isObject(parsed.usage_totals) ? parsed.usage_totals : {};
      const outcomes = Object.values(outcomesValue);
      const counts = outcomeCounts(outcomes);
      runs.push({
        runId: deckIdValue,
        format: "mrph",
        date: dateOf(deckIdValue),
        processor: asString(parsed.backend_label) ?? "",
        models: modelsOf(rows),
        cards: outcomes.length,
        written: counts.written,
        failed: counts.failed,
        skipped: counts.skipped,
        requests: asFiniteNumber(usageTotals.requests) ?? rows.length,
        cost: asFiniteNumber(usageTotals.cost),
        answers: archive.answers,
      });
    } else {
      skipped.push({ dir: archive.dir, reason: "unknown report format" });
    }
  }

  const v2: FormatTotals = { runs: 0, cards: 0, written: 0, cost: 0 };
  const mrph: FormatTotals = { runs: 0, cards: 0, written: 0, cost: 0 };
  let cards = 0;
  let written = 0;
  let failed = 0;
  let skippedRuns = 0;
  let requests = 0;
  let answers = 0;
  let cost = 0;
  let unpriced = 0;
  const modelRuns = new Map<string, number>();

  for (const run of runs) {
    const bucket = run.format === "v2" ? v2 : mrph;
    bucket.runs += 1;
    bucket.cards += run.cards;
    bucket.written += run.written;
    bucket.cost += run.cost ?? 0;

    cards += run.cards;
    written += run.written;
    failed += run.failed;
    skippedRuns += run.skipped;
    requests += run.requests;
    answers += run.answers;
    if (run.cost === null) unpriced += 1;
    else cost += run.cost;

    for (const model of run.models) {
      modelRuns.set(model, (modelRuns.get(model) ?? 0) + 1);
    }
  }

  const totals: RunsTotals = {
    runs: runs.length,
    v2,
    mrph,
    cards,
    written,
    failed,
    skipped: skippedRuns,
    requests,
    answers,
    cost,
    unpriced,
    models: Array.from(modelRuns, ([model, count]) => ({ model, runs: count })),
    from: runs.length > 0 ? runs[0].date : "",
    to: runs.length > 0 ? runs[runs.length - 1].date : "",
  };

  return { runs, skipped, totals };
}
