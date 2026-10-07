import type { Card } from "../cards/types.js";

export function buildRetry(
  card: Card,
  attempt: number,
  acceptanceOutput: string,
  previousDiff: string | null
): Card {
  if (attempt !== 1 && attempt !== 2) {
    throw new Error("buildRetry: attempt must be 1 or 2");
  }
  const base = card.customId.replace(/\.r[0-9]+$/, "");
  let instruction: string;
  if (previousDiff === null) {
    instruction =
      card.instruction +
      "\n\n<acceptance_output>\nA previous attempt was discarded before acceptance could run:\n" +
      acceptanceOutput +
      "\n</acceptance_output>\nProduce the complete file again, from the context given above.";
  } else {
    instruction =
      card.instruction +
      "\n\n<acceptance_output>\nA previous attempt failed its acceptance check (`" +
      (card.acceptance ?? "") +
      "`):\n" +
      acceptanceOutput +
      "\n</acceptance_output>\nPlease fix the issues and produce the complete corrected file.";
    if (previousDiff !== "") {
      instruction +=
        "\n\n<previous_attempt_diff>\nYour previous attempt changed the file like this (unified diff):\n" +
        previousDiff +
        "\n</previous_attempt_diff>\nThe diff above is YOUR OWN previous edit, not a proposed change: correct it where it went wrong rather than rewriting the file from scratch.";
    }
  }
  return {
    customId: base + ".r" + attempt,
    intent: card.intent,
    targets: card.targets,
    contextSlice: card.contextSlice,
    instruction,
    acceptance: card.acceptance,
    model: card.model,
    maxTokens: card.maxTokens,
    reasoning: card.reasoning,
    variants: card.variants,
    dependsOn: []
  };
}
