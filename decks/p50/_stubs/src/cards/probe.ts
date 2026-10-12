/** Issue #50, F1/F3: a probe file's own path, by the record's naming (basename ends "_probe_test.go" or
 * ".probe.ts", or a path segment "probe"). */
export function isProbeFile(p: string): boolean {
  throw new Error("stub isProbeFile: " + p);
}

/** The compile lines of a log that name a probe file, once each, sorted (issue #50). */
export function probeLines(log: string, fileLines: readonly string[]): string[] {
  throw new Error("stub probeLines");
}