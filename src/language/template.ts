import { posix } from "node:path";
import { hasExtension, testTarget } from "./paths.js";
import { fillTemplate } from "./profiles.js";
import type { JudgeInputs, LanguageProfile } from "./types.js";

export function acceptanceLines(profile: LanguageProfile, targets: readonly string[]): string[] {
  const own = targets.filter((t) => hasExtension(profile, t));
  const lines: string[] = [];
  if (own.length > 0) {
    let parse = profile.parseLine;
    if (profile.parseTakesFiles) {
      parse = parse + " " + own.join(" ");
    }
    lines.push(parse);
    lines.push(fillTemplate(profile.lintLine, { files: own.join(" ") }));
  }
  const test = testTarget(profile, targets);
  if (test !== null) {
    lines.push(fillTemplate(profile.ownTestLine, { test }));
  }
  lines.push(profile.fullRunLine);
  return lines;
}

export function acceptanceScript(profile: LanguageProfile, customId: string, targets: readonly string[]): string {
  let script = "D=/tmp/morph/" + customId + "; mkdir -p $D; S=$(date +%s)-$$; L=$D/acc-$S.log\n";
  for (let i = 0; i < targets.length; i++) {
    const ext = posix.extname(targets[i]);
    script += "cp " + targets[i] + " $D/" + i + "-$S" + ext + " 2>/dev/null\n";
  }
  script += "(\n";
  script += " set -e\n";
  for (const line of acceptanceLines(profile, targets)) {
    script += " " + line + "\n";
  }
  script += ") > $L 2>&1; rc=$?; cat $L; exit $rc\n";
  return script;
}

export function judgeInstruction(profile: LanguageProfile, inputs: JudgeInputs): string {
  return fillTemplate(profile.judgeInstruction, {
    test: inputs.test,
    module: inputs.module,
    docs: [...inputs.docs, "this instruction"].join(", "),
  });
}
