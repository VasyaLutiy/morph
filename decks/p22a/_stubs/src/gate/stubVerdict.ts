export interface StubVerdict { stage: string | null; expected: string; outside: string[]; failures: string[] }
export function expectedStage(acceptance: string): string {
  throw new Error("stub expectedStage " + String(acceptance.length));
}
export function stubVerdict(log: string, expected: string, targets: readonly string[], fileLines: readonly string[],
  stages: readonly string[] | null = ["build", "vet", "tsc"]): StubVerdict {
  throw new Error("stub stubVerdict " + JSON.stringify([log.length, expected, targets.length, fileLines.length, stages]));
}
