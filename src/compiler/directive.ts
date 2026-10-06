export function outputDirective(targets: string[]): string {
  if (targets.length === 0) {
    throw new Error("outputDirective: targets is empty");
  }
  if (targets.length === 1) {
    return (
      "Answer with the complete new content of " +
      targets[0] +
      " in one fenced block and nothing else."
    );
  }
  return (
    "Answer with one section per file, each starting with a line `FILE: <path>` " +
    "followed by one fenced block; every target exactly once, no other text. " +
    "The targets, in this order: " +
    targets.join(", ") +
    "."
  );
}
