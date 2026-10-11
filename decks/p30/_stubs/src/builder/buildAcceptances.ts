import { layerGenerations } from "../cards/layer.js";
import { hasExtension, testTarget } from "../language/paths.js";
import { codeAcceptance, judgeAcceptance } from "./compose.js";
import { goCodeAcceptance, goJudgeAcceptance } from "./goAcceptance.js";
import { untrackedStep } from "./steps.js";
import { TRANSACTION_MARK } from "../cards/transaction.js";
import type { Deck } from "../cards/types.js";
import type { BuildInput, BuildResult, CardContext, Checks } from "./types.js";
import type { Card } from "../cards/types.js";
import type { LanguageProfile } from "../language/types.js";

export const HEREDOC_TAGS: readonly string[] = [
  "MORPH_GUARD_EOF",
  "MORPH_CONF_EOF",
  "MORPH_TSCONF_EOF",
  "MORPH_FIRSTDIFF_EOF",
  "MORPH_PROBE_EOF",
  "MORPH_LITS_EOF",
];

function tagErrors(kind: string, text: string): string[] {
  const errors: string[] = [];
  for (const tag of HEREDOC_TAGS) {
    if (text.includes(tag)) {
      errors.push("the " + kind + " holds the heredoc tag " + tag);
    }
  }
  return errors;
}

export function probeFile(profile: LanguageProfile, id: string): string {
  if (profile.id === "go") {
    return "_" + id + "_probe_test.go";
  }
  return id + ".probe.ts";
}

export function buildAcceptances(input: BuildInput): BuildResult {
  if (input.profile.id !== "typescript" && input.profile.id !== "go") {
    return {
      ok: false,
      errors: [
        "no acceptance builder for language '" + input.profile.id + "' (only typescript, go)",
      ],
    };
  }

  const checks: Checks = input.checks;
  const errors: string[] = tagErrors("guard", input.texts.guard);
  for (const e of tagErrors("first-difference locator", input.texts.firstdiff)) {
    errors.push(e);
  }

  const byId = new Map<string, Card>();
  for (const card of input.cards) {
    byId.set(card.customId, card);
  }

  const members: Card[] = [];
  for (const check of checks.cards) {
    const card = byId.get(check.id);
    if (card === undefined) {
      errors.push("checks card '" + check.id + "' is not in the deck");
      continue;
    }
    if (!card.targets.some((t) => hasExtension(input.profile, t))) {
      errors.push("card '" + check.id + "' has no " + input.profile.id + " target");
    }
    if (check.files !== null) {
      const paths = check.files.map((f) => f.file);
      if (JSON.stringify(paths) !== JSON.stringify(card.targets)) {
        errors.push(
          "judge '" + check.id + "': files " +
            JSON.stringify(paths) + " are not its targets " + JSON.stringify(card.targets),
        );
      }
    } else {
      const probe = Object.prototype.hasOwnProperty.call(input.texts.probes, check.id)
        ? input.texts.probes[check.id]
        : undefined;
      if (probe === undefined) {
        errors.push("code card '" + check.id + "' has no probe");
      } else {
        for (const tag of HEREDOC_TAGS) {
          if (probe.includes(tag)) {
            errors.push("the probe of " + check.id + " holds the heredoc tag " + tag);
          }
        }
      }
      const test = testTarget(input.profile, card.targets);
      if (check.smoke === null) {
        if (test !== null) {
          errors.push("code card '" + check.id + "' targets the test " + test + " but has no smoke cap");
        }
      } else if (test === null) {
        errors.push("code card '" + check.id + "' has a smoke cap but no test target");
      }
    }
    members.push(card);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const memberDeck: Deck = { cards: members, externalDependsOn: [] };
  const generations = layerGenerations(memberDeck);
  const generationOf = new Map<string, number>();
  for (let g = 0; g < generations.length; g++) {
    for (const id of generations[g]) {
      generationOf.set(id, g);
    }
  }
  const siblingsOf = new Map<string, string[]>();
  for (const member of members) {
    const gen = generationOf.get(member.customId) ?? 0;
    const siblings: string[] = [];
    for (const other of members) {
      if (other !== member && (generationOf.get(other.customId) ?? 0) === gen) {
        for (const t of other.targets) {
          siblings.push(t);
        }
      }
    }
    siblingsOf.set(member.customId, siblings);
  }

  const isTransaction = input.transaction === true;

  const acceptanceOf = new Map<string, string>();
  for (const check of checks.cards) {
    const card = byId.get(check.id);
    if (card === undefined) {
      continue;
    }
    const allowed: string[] =
      input.uses !== undefined && Object.prototype.hasOwnProperty.call(input.uses, card.customId)
        ? input.uses[card.customId]
        : [];
    const baseSiblings = siblingsOf.get(card.customId) ?? [];
    const hidden: string[] | undefined =
      isTransaction
        ? undefined
        : input.hide !== undefined && Object.prototype.hasOwnProperty.call(input.hide, card.customId)
          ? input.hide[card.customId]
          : undefined;
    const ctxSiblings: string[] =
      isTransaction ? [] : hidden === undefined ? baseSiblings : baseSiblings.slice();
    const ctxFullExclude: string[] = hidden === undefined ? checks.fullExclude : checks.fullExclude.slice();
    if (hidden !== undefined) {
      for (const path of hidden) {
        if (!ctxSiblings.includes(path)) {
          ctxSiblings.push(path);
        }
      }
      for (const path of hidden) {
        if (!ctxFullExclude.includes(path)) {
          ctxFullExclude.push(path);
        }
      }
    }
    const ctx: CardContext = {
      id: card.customId,
      phase: checks.phase,
      targets: card.targets,
      siblings: ctxSiblings,
      frozen: checks.frozen,
      fullExclude: ctxFullExclude,
      ownGit: checks.ownGit,
      profile: input.profile,
      guard: input.texts.guard,
      firstdiff: input.texts.firstdiff,
      allowed,
      vendor: input.vendor === true,
    };
    if (check.files !== null) {
      acceptanceOf.set(
        card.customId,
        input.profile.id === "go"
          ? goJudgeAcceptance(ctx, check.files)
          : judgeAcceptance(ctx, check.files),
      );
    } else {
      const probe = input.texts.probes[check.id] ?? "";
      acceptanceOf.set(
        card.customId,
        input.profile.id === "go"
          ? goCodeAcceptance(ctx, probe, check.smoke, check.extra)
          : codeAcceptance(ctx, probe, check.smoke, check.extra),
      );
    }
  }

  let allTargets: readonly string[] = [];
  if (isTransaction) {
    const seen = new Set<string>();
    const collected: string[] = [];
    for (const member of members) {
      for (const t of member.targets) {
        if (!seen.has(t)) {
          seen.add(t);
          collected.push(t);
        }
      }
    }
    allTargets = collected;
  }

  const cards: Card[] = input.cards.map((card) => {
    const acceptance = acceptanceOf.get(card.customId);
    if (acceptance === undefined) {
      return card;
    }
    if (isTransaction) {
      return {
        ...card,
        acceptance:
          TRANSACTION_MARK +
          "\n" +
          acceptance.replace(untrackedStep(card.targets), () => untrackedStep(allTargets)),
      };
    }
    return { ...card, acceptance };
  });
  return { ok: true, cards };
}
