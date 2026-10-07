import fs from "node:fs";
import path from "node:path";
import type { Card, Fault } from "../cards/types.js";
import { captureInputs } from "./capture.js";
import { outputDirective } from "./directive.js";
import type { CompileResult, Message, Request } from "./types.js";

function tagged(tag: "file_contents" | "original_file", p: string, content: string): string {
  const body = content === "" || content.endsWith("\n") ? content : content + "\n";
  return "<" + tag + ' path="' + p + '">\n' + body + "</" + tag + ">";
}

function isRegularFile(abs: string): boolean {
  let stat: fs.Stats | null = null;
  try {
    stat = fs.statSync(abs);
  } catch {
    stat = null;
  }
  return stat !== null && stat.isFile();
}

function existsAtAll(abs: string): boolean {
  let stat: fs.Stats | null = null;
  try {
    stat = fs.statSync(abs);
  } catch {
    stat = null;
  }
  return stat !== null;
}

function readText(abs: string): string {
  return fs.readFileSync(abs, "utf8");
}

export function compileCard(card: Card, root: string): CompileResult {
  // 1. faults first, all at once
  const faults: Fault[] = [];
  const sliceSorted = [...card.contextSlice].sort();
  for (const p of sliceSorted) {
    const abs = path.join(root, p);
    if (!existsAtAll(abs)) {
      faults.push({ key: "contextSlice", message: `contextSlice '${p}' does not exist` });
    } else if (!isRegularFile(abs)) {
      faults.push({ key: "contextSlice", message: `contextSlice '${p}' is not a file` });
    }
  }
  if (card.intent === "patch") {
    for (const p of card.targets) {
      const abs = path.join(root, p);
      if (existsAtAll(abs) && !isRegularFile(abs)) {
        faults.push({ key: "targets", message: `targets '${p}' is not a file` });
      }
    }
  }
  if (faults.length > 0) return { ok: false, faults };

  // 2. messages
  const buildMessages = (): Message[] => {
    const messages: Message[] = [];
    if (card.intent === "patch") {
      for (const p of card.targets) {
        const abs = path.join(root, p);
        const content = isRegularFile(abs)
          ? `Original file ${p}:\n` + tagged("original_file", p, readText(abs))
          : `Target ${p} is a new file: it does not exist yet.`;
        messages.push({ role: "user", content });
      }
    }
    for (const p of sliceSorted) {
      const content = `Contents of file ${p}:\n` + tagged("file_contents", p, readText(path.join(root, p)));
      messages.push({ role: "user", content });
    }
    messages.push({
      role: "user",
      content: card.instruction + "\n\n" + outputDirective(card.targets),
    });
    return messages;
  };

  // 3. requests, each with its own message objects
  const requests: Request[] = [];
  for (let n = 1; n <= card.variants; n++) {
    requests.push({
      customId: `${card.customId}.v${n}`,
      model: card.model,
      maxTokens: card.maxTokens,
      reasoning: card.reasoning,
      messages: buildMessages(),
    });
  }

  return { ok: true, requests, inputs: captureInputs(card, root) };
}
