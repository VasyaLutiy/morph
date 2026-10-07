const FENCE = "```";

export function outputDirective(targets: readonly string[]): string {
  if (targets.length === 0) {
    throw new Error("outputDirective: targets is empty");
  }
  if (targets.length === 1) {
    const p = targets[0];
    return (
      "Return the complete content of " +
      p +
      " as ONE fenced block, and nothing else:\n\n" +
      FENCE +
      "\n<the complete content of " +
      p +
      ">\n" +
      FENCE +
      "\n\nThe opening fence may name the file's language. Only the FIRST fenced block of the answer becomes the file: a second block (a diff, an edit summary, an example) is dropped, and every line outside the fence is discarded. An answer with no fence at all is written to the file verbatim, prose and all. An answer whose fences do not pair up is discarded unread as cut off, so no line of the file may begin with three backticks. No preamble, no closing commentary, no diff, no elision: the whole file."
    );
  }
  const n = targets.length;
  return (
    "This card writes " +
    n +
    " files. Return each one as a line `FILE: <path>` followed by ONE fenced block holding its complete content:\n\nFILE: <path>\n" +
    FENCE +
    "\n<the complete content of that file>\n" +
    FENCE +
    "\n\nOne such pair per file, every file exactly once, in this order:\n" +
    targets.join("\n") +
    "\n\nUse exactly these paths, each file whole: no diff, no elision. An answer that misses a file, gives one twice or names a file not in this list is discarded whole. Only the first fenced block after a FILE: line is that file's content: a second block (a diff, an edit summary, an example) is dropped. Lines outside the fenced blocks are ignored, but no other line may begin with FILE:. An answer whose fences do not pair up is discarded unread as cut off, so no line of a file may begin with three backticks."
  );
}
