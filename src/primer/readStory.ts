export interface StoryTexts {
  measure: string | null;
  plan: string | null;
  autonomy: string | null;
  decisions: string | null;
  issues: string | null;
}

export interface StoryRun {
  runId: string;
  models: string[];
}

export interface ChronologyLine {
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

export interface StoryIssue {
  number: number;
  title: string;
  labels: string[];
}

export interface Story {
  chronology: ChronologyLine[];
  next: { phase: string | null; row: string | null; handoff: string[] };
  decisions: string[];
  issues: { state: "read" | "absent" | "unreadable"; items: StoryIssue[] };
  missing: string[];
}

interface Table {
  header: string[];
  rows: string[][];
}

const SEPARATOR = /^\|?[\s:|-]*-[\s:|-]*$/;
const PHASE_HEADER = "фаза";
const BUILDER_HEADER = "строитель";
const RUNS_HEADER = "прогоны";
const CARDS_HEADER = "карт";
const COST_HEADER = "$";
const MAIN_PHASE = /^P\d+[a-z0-9]*$/;
const CARDS = /^(\d+)\s*\/\s*(\d+)/;
const RUN_ID = /\d{8}-\d{6}(?:-[0-9a-f]{8})?/g;
const DATE = /^(\d{4})(\d{2})(\d{2})-/;
const NEXT_WORD = /\bNext\b/;
const REST_STARTS_LETTER = /^[a-z]/;
const PHASE_ENDS_LETTER = /[a-z]$/;
const REST_DIGITS = /^[0-9]+$/;
const HANDOFF_HEADING = "## State at handoff";
const DASH = "- ";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bare(value: string): string {
  return value.split("**").join("").trim();
}

function cells(line: string): string[] {
  let body = line.trim();
  if (body.startsWith("|")) {
    body = body.slice(1);
  }
  const escapedTail = body.length >= 2 && body.slice(-2, -1) === "\\";
  if (body.endsWith("|") && !escapedTail) {
    body = body.slice(0, -1);
  }
  return body
    .split(/(?<!\\)\|/)
    .map((piece) => piece.trim().split("\\|").join("|"));
}

function findTables(source: string): Table[] {
  const lines = source.split("\n");
  const tables: Table[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = text(lines[i]);
    const next = text(lines[i + 1]);
    if (line.trim().startsWith("|") && SEPARATOR.test(next.trim())) {
      const header = cells(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && text(lines[j]).trim().startsWith("|")) {
        rows.push(cells(text(lines[j])));
        j += 1;
      }
      tables.push({ header, rows });
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return tables;
}

function headerIndex(header: readonly string[], name: string): number {
  for (let i = 0; i < header.length; i += 1) {
    if (bare(text(header[i])) === name) return i;
  }
  return -1;
}

function headerPrefix(header: readonly string[], prefix: string): number {
  for (let i = 0; i < header.length; i += 1) {
    if (bare(text(header[i])).startsWith(prefix)) return i;
  }
  return -1;
}

function cellAt(row: readonly string[], index: number): string {
  if (index < 0) return "";
  return text(row[index]);
}

function tablesWith(source: readonly Table[], name: string): Table[] {
  const out: Table[] = [];
  for (const table of source) {
    if (headerIndex(table.header, name) >= 0) out.push(table);
  }
  return out;
}

function firstTable(tables: readonly Table[]): Table | null {
  for (const table of tables) return table;
  return null;
}

function lastTable(tables: readonly Table[]): Table | null {
  let found: Table | null = null;
  for (const table of tables) found = table;
  return found;
}

function cutBuilder(builder: string): string {
  const at = builder.indexOf(" (");
  return (at === -1 ? builder : builder.slice(0, at)).trim();
}

function notesOf(cardsCell: string): string {
  const open = cardsCell.indexOf("(");
  if (open === -1) return "";
  const close = cardsCell.lastIndexOf(")");
  const end = close > open ? close : cardsCell.length;
  const notes = cardsCell.slice(open + 1, end).trim();
  return notes.length > 100 ? notes.slice(0, 99) + "…" : notes;
}

function dateOf(runId: string | undefined): string {
  if (runId === undefined) return "";
  const parts = DATE.exec(runId);
  if (parts === null) return "";
  return `${text(parts[1])}-${text(parts[2])}-${text(parts[3])}`;
}

function modelsOf(ids: readonly string[], runs: readonly StoryRun[]): string[] {
  const models: string[] = [];
  for (const id of ids) {
    const run = runs.find((candidate) => candidate.runId === id);
    if (run === undefined) continue;
    for (const model of run.models) {
      if (!models.includes(model)) models.push(model);
    }
  }
  return models;
}

function chronologyOf(measure: string | null, runs: readonly StoryRun[]): ChronologyLine[] {
  if (measure === null) return [];
  const table = firstTable(tablesWith(findTables(measure), PHASE_HEADER));
  if (table === null) return [];
  const phaseIndex = headerIndex(table.header, PHASE_HEADER);
  const builderIndex = headerIndex(table.header, BUILDER_HEADER);
  const cardsIndex = headerPrefix(table.header, CARDS_HEADER);
  const costIndex = headerPrefix(table.header, COST_HEADER);
  const runsIndex = headerIndex(table.header, RUNS_HEADER);
  const lines: ChronologyLine[] = [];
  let previousBuilder: string | null = null;
  let lastModels: string | null = null;
  for (const row of table.rows) {
    const phase = bare(cellAt(row, phaseIndex));
    const builder = cutBuilder(bare(cellAt(row, builderIndex)));
    const cardsCell = cellAt(row, cardsIndex).trim();
    let planned: number | null = null;
    let written: number | null = null;
    const cards = CARDS.exec(cardsCell);
    if (cards !== null) {
      planned = Number(text(cards[1]));
      written = Number(text(cards[2]));
    }
    const notes = notesOf(cardsCell);
    const costMatch = cellAt(row, costIndex).match(/\d+(?:\.\d+)?/);
    const cost = costMatch === null ? "" : text(costMatch[0]);
    const ids: string[] = cellAt(row, runsIndex).match(RUN_ID) ?? [];
    const firstId = ids.length > 0 ? ids[0] : undefined;
    const date = dateOf(firstId);
    const models = modelsOf(ids, runs);
    const switches: string[] = [];
    if (MAIN_PHASE.test(phase)) {
      if (previousBuilder !== null) {
        if (previousBuilder !== builder) {
          switches.push(`builder ${previousBuilder} → ${builder}`);
        }
        const joined = models.join(", ");
        if (models.length > 0 && lastModels !== null && joined !== lastModels) {
          switches.push(`model ${lastModels} → ${joined}`);
        }
      }
      previousBuilder = builder;
      if (models.length > 0) lastModels = models.join(", ");
    }
    lines.push({
      phase,
      date,
      builder,
      models,
      written,
      planned,
      runs: ids.length,
      notes,
      cost,
      switches,
    });
  }
  return lines;
}

function isDone(phase: string, done: readonly string[]): boolean {
  for (const main of done) {
    if (main === phase) return true;
    if (!main.startsWith(phase)) continue;
    const rest = main.slice(phase.length);
    if (REST_STARTS_LETTER.test(rest)) return true;
    if (PHASE_ENDS_LETTER.test(phase) && REST_DIGITS.test(rest)) return true;
  }
  return false;
}

function rowText(row: readonly string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < 3 && i < row.length; i += 1) {
    parts.push(bare(text(row[i])));
  }
  const joined = parts.join(" · ");
  return joined.length > 300 ? joined.slice(0, 299) + "…" : joined;
}

function nextOf(plan: string | null, done: readonly string[]): { phase: string | null; row: string | null } {
  if (plan === null) return { phase: null, row: null };
  const table = lastTable(tablesWith(findTables(plan), PHASE_HEADER));
  if (table === null) return { phase: null, row: null };
  const phaseIndex = headerIndex(table.header, PHASE_HEADER);
  for (const row of table.rows) {
    const phase = bare(cellAt(row, phaseIndex));
    if (isDone(phase, done)) continue;
    return { phase, row: rowText(row) };
  }
  return { phase: null, row: null };
}

function handoffOf(autonomy: string | null): string[] {
  if (autonomy === null) return [];
  const lines = autonomy.split("\n");
  let heading = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (text(lines[i]).startsWith(HANDOFF_HEADING)) {
      heading = i;
      break;
    }
  }
  if (heading === -1) return [];
  const out: string[] = [text(lines[heading]).slice(3).trim()];
  const section: string[] = [];
  for (let i = heading + 1; i < lines.length; i += 1) {
    const line = text(lines[i]);
    if (line.startsWith("## ")) break;
    const trimmed = line.trim();
    if (trimmed !== "") section.push(trimmed);
  }
  let from = -1;
  for (let i = 0; i < section.length; i += 1) {
    if (NEXT_WORD.test(text(section[i]))) {
      from = i;
      break;
    }
  }
  if (from === -1) from = 0;
  for (let i = from; i < section.length && i < from + 4; i += 1) {
    const line = text(section[i]);
    out.push(line.length > 200 ? line.slice(0, 199) + "…" : line);
  }
  return out;
}

function decisionsOf(decisions: string | null): string[] {
  if (decisions === null) return [];
  const lines: string[] = [];
  for (const raw of decisions.split("\n")) {
    const line = raw.trim();
    if (line !== "") lines.push(line);
  }
  const start = lines.length > 5 ? lines.length - 5 : 0;
  const out: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    let line = text(lines[i]);
    if (line.startsWith(DASH)) line = line.slice(2);
    out.push(line.length > 300 ? line.slice(0, 299) + "…" : line);
  }
  return out;
}

function issuesOf(issues: string | null): { state: "read" | "absent" | "unreadable"; items: StoryIssue[] } {
  if (issues === null) return { state: "absent", items: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(issues) as unknown;
  } catch {
    return { state: "unreadable", items: [] };
  }
  if (!Array.isArray(parsed)) return { state: "unreadable", items: [] };
  const list: unknown[] = parsed;
  const items: StoryIssue[] = [];
  for (const element of list) {
    if (element === null || typeof element !== "object" || Array.isArray(element)) continue;
    const record = element as Record<string, unknown>;
    const number = record["number"];
    const title = record["title"];
    if (typeof number !== "number" || !Number.isInteger(number)) continue;
    if (typeof title !== "string") continue;
    const labels: string[] = [];
    const rawLabels = record["labels"];
    if (Array.isArray(rawLabels)) {
      for (const label of rawLabels) {
        if (typeof label === "string") {
          labels.push(label);
          continue;
        }
        if (label === null || typeof label !== "object" || Array.isArray(label)) continue;
        const name = (label as Record<string, unknown>)["name"];
        if (typeof name === "string") labels.push(name);
      }
    }
    items.push({ number, title, labels });
  }
  return { state: "read", items };
}

export function readStory(texts: StoryTexts, runs: StoryRun[]): Story {
  const chronology = chronologyOf(texts.measure, runs);
  const done: string[] = [];
  for (const line of chronology) {
    if (MAIN_PHASE.test(line.phase)) done.push(line.phase);
  }
  const next = nextOf(texts.plan, done);
  const missing: string[] = [];
  if (texts.measure === null) missing.push("measure");
  if (texts.plan === null) missing.push("plan");
  if (texts.autonomy === null) missing.push("autonomy");
  if (texts.decisions === null) missing.push("decisions");
  return {
    chronology,
    next: { phase: next.phase, row: next.row, handoff: handoffOf(texts.autonomy) },
    decisions: decisionsOf(texts.decisions),
    issues: issuesOf(texts.issues),
    missing,
  };
}
