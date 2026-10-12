import type { RecordGaps } from "./recordGaps.js";
import type { LayerGap } from "./importGaps.js";

export type RecordSection =
  | { state: "not read"; reason: string }
  | {
      state: "read";
      gaps: RecordGaps;
      layers:
        | { checked: false; reason: string }
        | { checked: true; gaps: LayerGap[] };
    };

export const RECORD_CAP = 10;
export const WEIGHT_RULE = 30000;

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function list(title: string, items: string[]): string[] {
  if (items.length === 0) {
    return [`- ${title}: none`];
  }
  const lines: string[] = [`- ${title} (${items.length}):`];
  for (const item of items.slice(0, RECORD_CAP)) {
    lines.push(`  - ${item}`);
  }
  if (items.length > RECORD_CAP) {
    lines.push(`  - … +${items.length - RECORD_CAP} more`);
  }
  return lines;
}

export function renderRecord(section: RecordSection): string {
  const lines: string[] = ["", "## Record vs code", ""];

  if (section.state === "not read") {
    lines.push(`- record: not read: ${section.reason}`);
    return lines.join("\n") + "\n";
  }

  const { gaps, layers } = section;

  lines.push(
    `- record: read: ${gaps.components} ${plural(
      gaps.components,
      "Component",
      "Components",
    )}, ${gaps.functions} ${plural(
      gaps.functions,
      "Function",
      "Functions",
    )} (contour.yaml, morph-map.json)`,
  );

  lines.push(
    ...list(
      "recorded, not built",
      gaps.notBuilt.map((n) => `${n.component}/${n.function}: ${n.reason}`),
    ),
  );

  lines.push(...list("built, not recorded", gaps.notRecorded));

  const weights = gaps.weights;
  if (weights.length === 0) {
    lines.push("- Component weight: none");
  } else {
    const over = weights.filter((w) => w.bytes > WEIGHT_RULE).length;
    lines.push(
      `- Component weight, heaviest first (${over} of ${weights.length} over ${WEIGHT_RULE} bytes):`,
    );
    for (const w of weights.slice(0, RECORD_CAP)) {
      const suffix = w.bytes > WEIGHT_RULE ? " — over the rule" : "";
      lines.push(`  - ${w.component}: ${w.bytes} bytes${suffix}`);
    }
    if (weights.length > RECORD_CAP) {
      lines.push(`  - … +${weights.length - RECORD_CAP} more`);
    }
  }

  lines.push(...list("record warnings", gaps.warnings));

  if (!layers.checked) {
    lines.push(`- layer gaps: not checked: ${layers.reason}`);
  } else {
    lines.push(
      ...list(
        "layer gaps",
        layers.gaps.map((g) => `${g.from} → ${g.to} (${g.file})`),
      ),
    );
  }

  return lines.join("\n") + "\n";
}
