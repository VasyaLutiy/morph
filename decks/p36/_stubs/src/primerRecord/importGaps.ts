export interface CodeText {
  path: string;
  text: string;
}

export interface LayerGap {
  from: string;
  to: string;
  file: string;
}

export function importGaps(
  language: string,
  module: string,
  files: readonly CodeText[],
  edges: Record<string, string[]>,
): LayerGap[] {
  throw new Error("stub importGaps " + language + module + files.length + Object.keys(edges).length);
}
