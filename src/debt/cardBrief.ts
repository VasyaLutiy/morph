import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { loadDeck } from "../cards/model.js";
import type { Card } from "../cards/types.js";

export interface DebtResult {
  code: 0 | 1 | 2 | 3 | 4;
  document: unknown;
}

export type FoundCard = { ok: true; card: Card } | { ok: false; result: DebtResult };

export interface BriefFile {
  path: string;
  text: string | null;
}

export interface LastRun {
  runId: string;
  processor: string | null;
  status: string;
  reason: string | null;
  attempts: number;
  earlierFailures: number;
  acceptanceLog: string;
  answers: string[];
}

export interface BriefDocument {
  deck: string;
  card: string;
  intent: string;
  targets: BriefFile[];
  slice: BriefFile[];
  instruction: string;
  acceptance: string | null;
  maxTokens: number | null;
  model: string | null;
  dependsOn: string[];
  lastRun: LastRun | null;
  markdown?: string;
}

export interface BriefOptions {
  deck: string;
  id: string;
  md: boolean;
}

export const RUNS_DIR = ".morph/runs";

export function findCard(root: string, deckPath: string, id: string): FoundCard {
  const full = path.resolve(root, deckPath);
  if (!isRegularFile(full)) {
    return {
      ok: false,
      result: {
        code: 4,
        document: {
          error: { code: 4, kind: "UsageError", message: `deck file not found: ${deckPath}` },
        },
      },
    };
  }

  const loaded = loadDeck(readFileSync(full, "utf8"));
  if (!loaded.ok) {
    const message =
      "invalid deck: " + loaded.faults.map((f) => `${f.key}: ${f.message}`).join("; ");
    return {
      ok: false,
      result: { code: 2, document: { error: { code: 2, kind: "DeckError", message } } },
    };
  }

  const card = loaded.deck.cards.find((c) => c.customId === id);
  if (card === undefined) {
    const have = loaded.deck.cards.map((c) => c.customId).join(", ");
    return {
      ok: false,
      result: {
        code: 4,
        document: {
          error: {
            code: 4,
            kind: "UsageError",
            message: `no card '${id}' in ${deckPath} (have: ${have})`,
          },
        },
      },
    };
  }

  return { ok: true, card };
}

export function readLastRun(root: string, id: string): LastRun | null {
  const runsDir = path.resolve(root, RUNS_DIR);

  let names: string[];
  try {
    names = readdirSync(runsDir);
  } catch {
    return null;
  }
  names.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const pattern = new RegExp(`^${escapeRegExp(id)}(\\.r[0-9]+)?\\.v[0-9]+\\.answer\\.txt$`);

  for (const name of names) {
    const runDir = path.resolve(runsDir, name);

    let report: unknown;
    try {
      const reportPath = path.resolve(runDir, "report.json");
      if (!statSync(reportPath).isFile()) continue;
      report = JSON.parse(readFileSync(reportPath, "utf8"));
    } catch {
      continue;
    }

    const reportRec = asRecord(report);
    if (reportRec === null) continue;
    const outcome = findOutcome(reportRec, id);
    if (outcome === null) continue;

    return {
      runId: name,
      processor: typeof reportRec.processor === "string" ? reportRec.processor : null,
      status: typeof outcome.status === "string" ? outcome.status : "",
      reason: typeof outcome.reason === "string" ? outcome.reason : null,
      attempts: typeof outcome.attempts === "number" ? outcome.attempts : 0,
      earlierFailures: Array.isArray(outcome.earlierFailures) ? outcome.earlierFailures.length : 0,
      acceptanceLog: typeof outcome.acceptanceLog === "string" ? outcome.acceptanceLog : "",
      answers: readAnswers(runDir, name, pattern),
    };
  }

  return null;
}

export function renderBrief(doc: BriefDocument): string {
  const blocks: string[] = [];

  blocks.push(`# Debt brief: ${doc.card}`);

  const writeOnly = doc.targets.map((t) => `\`${t.path}\``).join(", ");
  blocks.push(
    `Write only: ${writeOnly}. Change no other file.\n` +
      `Then: \`morph accept --deck ${doc.deck} --id ${doc.card} --model <your model> --commit\`.`,
  );

  blocks.push(
    [
      `- deck: ${doc.deck}`,
      `- intent: ${doc.intent}`,
      `- maxTokens: ${doc.maxTokens === null ? "none" : String(doc.maxTokens)}`,
      `- model: ${doc.model === null ? "none" : doc.model}`,
      `- dependsOn: ${doc.dependsOn.length === 0 ? "none" : doc.dependsOn.join(", ")}`,
      lastRunLine(doc.lastRun),
    ].join("\n"),
  );

  blocks.push(`## Instruction\n\n${doc.instruction.trimEnd()}`);

  blocks.push(
    doc.acceptance === null
      ? "## Acceptance\n\nnone"
      : `## Acceptance\n\n<acceptance>\n${withNewline(doc.acceptance)}</acceptance>`,
  );

  if (doc.lastRun !== null) {
    const run = doc.lastRun;
    const answers =
      run.answers.length === 0 ? "none" : run.answers.map((a) => `\`${a}\``).join(", ");
    blocks.push(
      `## Last run\n\n<acceptance_log>\n${withNewline(run.acceptanceLog)}</acceptance_log>\n\n` +
        `Answers: ${answers}`,
    );
  }

  const targetsNow = doc.targets.map((t) =>
    t.text === null
      ? `Target ${t.path} does not exist yet.`
      : `<file path="${t.path}">\n${withNewline(t.text)}</file>`,
  );
  blocks.push(`## Targets now\n\n${targetsNow.join("\n\n")}`);

  const sliceBlocks = doc.slice.map((f) =>
    f.text === null
      ? `File ${f.path} is missing.`
      : `<file path="${f.path}">\n${withNewline(f.text)}</file>`,
  );
  blocks.push(`## Context slice\n\n${sliceBlocks.length === 0 ? "none" : sliceBlocks.join("\n\n")}`);

  return blocks.join("\n\n") + "\n";
}

export function cardBrief(root: string, args: BriefOptions): DebtResult {
  const found = findCard(root, args.deck, args.id);
  if (!found.ok) return found.result;

  const card = found.card;

  const targets: BriefFile[] = card.targets.map((p) => ({ path: p, text: readFileText(root, p) }));
  const slice: BriefFile[] = [...card.contextSlice]
    .sort()
    .map((p) => ({ path: p, text: readFileText(root, p) }));

  const document: BriefDocument = {
    deck: args.deck,
    card: card.customId,
    intent: card.intent,
    targets,
    slice,
    instruction: card.instruction,
    acceptance: card.acceptance,
    maxTokens: card.maxTokens,
    model: card.model,
    dependsOn: card.dependsOn,
    lastRun: readLastRun(root, card.customId),
  };

  if (args.md) document.markdown = renderBrief(document);

  return { code: 0, document };
}

function isRegularFile(full: string): boolean {
  try {
    return statSync(full).isFile();
  } catch {
    return false;
  }
}

function readFileText(root: string, rel: string): string | null {
  const full = path.resolve(root, rel);
  if (!isRegularFile(full)) return null;
  try {
    return readFileSync(full, "utf8");
  } catch {
    return null;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function findOutcome(
  report: Record<string, unknown>,
  id: string,
): Record<string, unknown> | null {
  if (!Array.isArray(report.outcomes)) return null;
  for (const entry of report.outcomes) {
    const rec = asRecord(entry);
    if (rec !== null && rec.customId === id) return rec;
  }
  return null;
}

function readAnswers(runDir: string, runId: string, pattern: RegExp): string[] {
  let names: string[];
  try {
    names = readdirSync(path.resolve(runDir, "answers"));
  } catch {
    return [];
  }
  return names
    .filter((name) => pattern.test(name))
    .sort()
    .map((name) => `${RUNS_DIR}/${runId}/answers/${name}`);
}

function withNewline(text: string): string {
  return text !== "" && !text.endsWith("\n") ? `${text}\n` : text;
}

function lastRunLine(run: LastRun | null): string {
  if (run === null) return "- last run: none";
  const processor = run.processor === null ? "none" : run.processor;
  const reason = run.reason === null ? "none" : run.reason;
  return (
    `- last run: ${run.runId}, processor ${processor}, ${run.status}, ` +
    `attempts ${run.attempts}, reason ${reason}`
  );
}
