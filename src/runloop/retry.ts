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
  let instruction =
    card.instruction +
    "\n\nYour previous attempt failed its acceptance. Fix exactly what the acceptance reports and return the whole file again.\nAcceptance output:\n" +
    acceptanceOutput;
  if (previousDiff !== null) {
    instruction +=
      "\n\nYour previous attempt (rejected):\n" +
      previousDiff +
      "\n\nThe diff above is your own previous edit: correct it where it went wrong instead of rewriting the files from scratch.";
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
