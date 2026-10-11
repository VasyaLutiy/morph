import type { CommandResult } from "./types.js";

export const CONFIG_FILE = "morph.config.yaml";

export interface ProjectConfig {
  version: 1;
  scout: {
    grepSkip: string[];
    budgets: { calls: number; reads: number; chars: number; rounds: number; deadlineSeconds: number };
    caps: { readLines: number; readChars: number; grepHits: number; grepLineChars: number; listEntries: number };
    seed: { files: number; chars: number };
  };
}

export type ConfigResult = { ok: true; config: ProjectConfig } | { ok: false; problems: string[] };

export const DEFAULT_CONFIG: ProjectConfig = undefined as unknown as ProjectConfig;

export function validateConfig(doc: unknown): ConfigResult {
  throw new Error("stub validateConfig " + typeof doc);
}

export function loadConfig(text: string | null, name: string = CONFIG_FILE): ConfigResult {
  throw new Error("stub loadConfig " + String(text) + name);
}

export function readProjectConfig(root: string): { ok: true; config: ProjectConfig } | { ok: false; result: CommandResult } {
  throw new Error("stub readProjectConfig " + root);
}
