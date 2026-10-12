import type { ContourMap, ContourRecord } from "../contour/types.js";
import type { LanguageProfile } from "../language/types.js";

export interface NotBuilt {
  component: string;
  function: string;
  reason: string;
}

export interface ComponentWeight {
  component: string;
  bytes: number;
}

export interface RecordInputs {
  record: ContourRecord;
  map: ContourMap;
  recordText: string;
  loaderWarnings: string[];
  files: readonly string[];
  profile: LanguageProfile;
  owned: readonly string[];
}

export interface RecordGaps {
  components: number;
  functions: number;
  notBuilt: NotBuilt[];
  notRecorded: string[];
  weights: ComponentWeight[];
  warnings: string[];
}

export function recordGaps(input: RecordInputs): RecordGaps {
  throw new Error("stub recordGaps " + input.recordText.length);
}

export function codeFiles(profile: LanguageProfile, files: readonly string[]): string[] {
  throw new Error("stub codeFiles " + profile.id + files.length);
}

export function componentWeights(text: string): ComponentWeight[] {
  throw new Error("stub componentWeights " + text.length);
}
