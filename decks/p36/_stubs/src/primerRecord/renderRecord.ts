import type { RecordGaps } from "./recordGaps.js";
import type { LayerGap } from "./importGaps.js";

export type RecordSection =
  | { state: "not read"; reason: string }
  | { state: "read"; gaps: RecordGaps; layers: { checked: false; reason: string } | { checked: true; gaps: LayerGap[] } };

export const RECORD_CAP = 10;
export const WEIGHT_RULE = 30000;

export function renderRecord(section: RecordSection): string {
  throw new Error("stub renderRecord " + section.state);
}
