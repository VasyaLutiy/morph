import { profileForPath } from "../language/paths.js";

export interface TestText {
  path: string;
  text: string;
}

export interface GuardrailInput {
  base: TestText[];
  head: TestText[];
}

export interface GuardrailRow {
  name: string;
  files: number;
  findings: number;
}

export interface Finding {
  kind: string;
  source: string;
  path: string | null;
  expected: string;
  got: string;
}

export interface GuardrailResult {
  rows: GuardrailRow[];
  findings: Finding[];
}

export const GUARDRAILS = ["Tests Kept", "No New Skips"] as const;

const TITLE_TYPESCRIPT = /(?<![\w$.])(?:test|it)\(\s*(["'`])(.*?)\1/g;
const TITLE_PYTHON = /^[ \t]*(?:async[ \t]+)?def[ \t]+(test\w*)[ \t]*\(/gm;
const SKIP_TYPESCRIPT = /(?<![\w$.])(?:test|it|describe)\.(?:only|skip|todo)\(/g;
const SKIP_PYTHON = /@(?:pytest\.mark\.(?:skipif|skip|xfail)|unittest\.skip)\b/g;

export function testTitles(text: string, profile: string): string[] {
  if (profile === "typescript") {
    const titles: string[] = [];
    for (const match of text.matchAll(TITLE_TYPESCRIPT)) {
      titles.push(match[2]);
    }
    return titles;
  }
  if (profile === "python") {
    const titles: string[] = [];
    for (const match of text.matchAll(TITLE_PYTHON)) {
      titles.push(match[1]);
    }
    return titles;
  }
  return [];
}

export function skipCount(text: string, profile: string): number {
  if (profile === "typescript") {
    return text.match(SKIP_TYPESCRIPT)?.length ?? 0;
  }
  if (profile === "python") {
    return text.match(SKIP_PYTHON)?.length ?? 0;
  }
  return 0;
}

function findFile(files: TestText[], path: string): TestText | null {
  for (const file of files) {
    if (file.path === path) {
      return file;
    }
  }
  return null;
}

export function checkGuardrails(input: GuardrailInput): GuardrailResult {
  const keptFindings: Finding[] = [];
  let keptFiles = 0;
  for (const file of input.base) {
    const profile = profileForPath(file.path);
    if (profile === null) {
      continue;
    }
    keptFiles += 1;
    const after = findFile(input.head, file.path);
    const headTitles = after === null ? null : testTitles(after.text, profile.id);
    const titles = Array.from(new Set(testTitles(file.text, profile.id)));
    for (const title of titles) {
      if (headTitles === null) {
        keptFindings.push({
          kind: "guardrail",
          source: "guardrail Tests Kept",
          path: file.path,
          expected: `the test "${title}" kept`,
          got: "the test file is gone at head",
        });
      } else if (!headTitles.includes(title)) {
        keptFindings.push({
          kind: "guardrail",
          source: "guardrail Tests Kept",
          path: file.path,
          expected: `the test "${title}" kept`,
          got: "no test of that name at head",
        });
      }
    }
  }

  const skipFindings: Finding[] = [];
  let skipFiles = 0;
  for (const file of input.head) {
    const profile = profileForPath(file.path);
    if (profile === null) {
      continue;
    }
    skipFiles += 1;
    const before = findFile(input.base, file.path);
    const was = before === null ? 0 : skipCount(before.text, profile.id);
    const now = skipCount(file.text, profile.id);
    if (now > was) {
      skipFindings.push({
        kind: "guardrail",
        source: "guardrail No New Skips",
        path: file.path,
        expected: `at most ${was} skipped or focused tests, as at base`,
        got: `${now} at head`,
      });
    }
  }

  return {
    rows: [
      { name: "Tests Kept", files: keptFiles, findings: keptFindings.length },
      { name: "No New Skips", files: skipFiles, findings: skipFindings.length },
    ],
    findings: [...keptFindings, ...skipFindings],
  };
}
