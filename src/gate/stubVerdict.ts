export interface StubVerdict {
  stage: string | null;
  expected: string;
  outside: string[];
  failures: string[];
}

const HEADER = /^== (\S+)/;
const HELD = " failed (see above)";

/** "probe" when the acceptance echoes `== probe` at the start of a line, else "guard". */
export function expectedStage(acceptance: string): string {
  for (const line of acceptance.split("\n")) {
    if (line.startsWith("echo '== probe'")) {
      return "probe";
    }
  }
  return "guard";
}

/**
 * Where a log stopped (the last `== <stage>` header, "verdict" for a held lint verdict),
 * its `FAIL ` / `--- FAIL: ` lines at the expected stage, and its compile lines naming a
 * file outside the card's targets. Pure: reads the text it is given only.
 */
export function stubVerdict(
  log: string,
  expected: string,
  targets: readonly string[],
  fileLines: readonly string[],
  stages: readonly string[] | null = ["build", "vet", "tsc"],
): StubVerdict {
  const outside: string[] = [];
  const failures: string[] = [];
  const known = new Set(targets);
  let current: string | null = null;

  for (const raw of log.split("\n")) {
    const line = raw.trimEnd();
    const header = HEADER.exec(line);
    if (header !== null) {
      current = line.includes(HELD) ? "verdict" : header[1];
      continue;
    }
    if (current === null) {
      continue;
    }
    const t = line.trim();
    if (current === expected && (t.startsWith("FAIL ") || t.startsWith("--- FAIL: "))) {
      if (!failures.includes(t)) {
        failures.push(t);
      }
    }
    if (stages !== null && !stages.includes(current)) {
      continue;
    }
    if (line === "" || line.startsWith(" ") || line.startsWith("\t")) {
      continue;
    }
    for (const source of fileLines) {
      const match = new RegExp(source).exec(line);
      if (match !== null) {
        if (!known.has(match[1])) {
          if (!outside.includes(line)) {
            outside.push(line);
          }
        }
        break;
      }
    }
  }

  return { stage: current, expected, outside, failures };
}
