import type { ParsedAnswer } from "./types.js";

function isFenceLine(line: string): boolean {
  return line.startsWith("```");
}

function bodyOf(lines: string[]): string {
  if (lines.length === 0) return "";
  return lines.join("\n") + "\n";
}

function stripLeadingDashes(content: string): string {
  const firstNewline = content.indexOf("\n");
  const firstLine = firstNewline === -1 ? content : content.slice(0, firstNewline);
  if (firstLine.trim() === "---") {
    return firstNewline === -1 ? "" : content.slice(firstNewline + 1);
  }
  return content;
}

function cleanPath(line: string): string {
  return line
    .slice("FILE:".length)
    .trim()
    .replace(/^[`"']+|[`"']+$/g, "");
}

interface Section {
  path: string;
  body: string | null; // null = no fenced block yet
}

function splitSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let inFence = false;
  let buf: string[] | null = null;
  for (const line of lines) {
    if (isFenceLine(line)) {
      inFence = !inFence;
      if (inFence) {
        if (current !== null && current.body === null) buf = [];
      } else if (buf !== null) {
        if (current !== null && current.body === null) current.body = bodyOf(buf);
        buf = null;
      }
      continue;
    }
    if (!inFence && line.startsWith("FILE:")) {
      current = { path: cleanPath(line), body: null };
      sections.push(current);
      buf = null;
      continue;
    }
    if (buf !== null) buf.push(line);
  }
  return sections;
}

function firstBlockBody(lines: string[]): string {
  let inside = false;
  const buf: string[] = [];
  for (const line of lines) {
    if (isFenceLine(line)) {
      if (inside) return bodyOf(buf);
      inside = true;
      continue;
    }
    if (inside) buf.push(line);
  }
  return "";
}

export function parseAnswer(answer: string, targets: string[]): ParsedAnswer {
  if (targets.length === 0) {
    throw new Error("parseAnswer requires at least one target");
  }
  const text = answer.replaceAll("\r\n", "\n");
  const lines = text.split("\n");
  const fenceCount = lines.filter(isFenceLine).length;
  if (fenceCount % 2 === 1) {
    return { truncated: true };
  }
  if (targets.length === 1) {
    const content =
      fenceCount > 0 ? firstBlockBody(lines) : text;
    return { files: { [targets[0]]: stripLeadingDashes(content) } };
  }
  const sections = splitSections(lines);
  const seen = new Set<string>();
  for (const s of sections) {
    if (seen.has(s.path)) {
      return { corrupt: `duplicate section for ${s.path}` };
    }
    seen.add(s.path);
  }
  for (const s of sections) {
    if (!targets.includes(s.path)) {
      return { corrupt: `extra section for ${s.path}` };
    }
  }
  for (const t of targets) {
    if (!seen.has(t)) {
      return { corrupt: `missing section for ${t}` };
    }
  }
  for (const t of targets) {
    const s = sections.find((sec) => sec.path === t);
    if (s !== undefined && s.body === null) {
      return { corrupt: `no fenced block for ${t}` };
    }
  }
  const files: Record<string, string> = {};
  for (const t of targets) {
    const s = sections.find((sec) => sec.path === t);
    if (s !== undefined && s.body !== null) {
      files[t] = stripLeadingDashes(s.body);
    }
  }
  return { files };
}
