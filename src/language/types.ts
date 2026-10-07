export type ProfileId = "typescript" | "python";
export type NameCase = "camel" | "snake";
export interface LanguageProfile {
  id: ProfileId; extensions: string[]; testDirs: string[]; testFilePattern: string; nameCase: NameCase;
  codeTarget: string; testTarget: string; judgeTarget: string;
  parseLine: string; parseTakesFiles: boolean; lintLine: string; ownTestLine: string; fullRunLine: string;
  finale: string; judgeInstruction: string; helpersModule: string;
}
export type ProfileResult = { ok: true; profile: LanguageProfile } | { ok: false; error: string };
export interface CutTargets { code: string; test: string; judge: string }
export type TargetsResult = { ok: true; slug: string; targets: CutTargets } | { ok: false; error: string };
export interface JudgeInputs { test: string; module: string; docs: string[] }
