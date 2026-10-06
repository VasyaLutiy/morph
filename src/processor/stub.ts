import fs from "node:fs";
import path from "node:path";
import type { Request } from "../compiler/types.js";
import type { ProcessorConfig, Reply } from "./types.js";

export function stubAnswer(request: Request, config: ProcessorConfig): Reply {
  const dir = config.answersDir ?? "";
  const primary = path.join(dir, request.customId + ".md");
  const stripped = request.customId.replace(/\.v[0-9]+$/, "");
  const secondary = path.join(dir, stripped + ".md");
  const usage = {
    customId: request.customId,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    provider: "stub",
    generationId: "stub-" + request.customId
  };
  for (const candidate of [primary, secondary]) {
    try {
      if (fs.statSync(candidate).isFile()) {
        return {
          answer: {
            customId: request.customId,
            text: fs.readFileSync(candidate, "utf8"),
            finishReason: "stop",
            error: null
          },
          usage
        };
      }
    } catch {
      // not a file: try the next candidate
    }
  }
  return {
    answer: {
      customId: request.customId,
      text: null,
      finishReason: null,
      error: "stub has no answer: " + primary
    },
    usage
  };
}
