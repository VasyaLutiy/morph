import path from "node:path";
import { parseCommand } from "./parse.js";
import { renderDocument, classifyThrown, readDeckFile } from "./document.js";
import { checkBuilds } from "./checkBuilds.js";
import { deckCheckCommand } from "./deckCheck.js";
import { runCommand } from "./runCommand.js";
import { planCommand } from "./planCommand.js";
import { collectBatch } from "../batches/collect.js";
import { submitDeck } from "../batches/submit.js";
import type { DetachedDeps } from "../batches/submit.js";
import { saveBatchAnswers, saveBatchRecord } from "../git/archive.js";
import { primerCommand } from "../primer/primerCommand.js";
import { scoutCommand } from "../scout/scoutCommand.js";
import { planFromScout } from "../scout/planFromScout.js";
import { reviewCommand } from "../reviewer/reviewCommand.js";
import { cardBrief } from "../debt/cardBrief.js";
import { acceptCard } from "../debt/acceptCard.js";
import { acceptGroup } from "../debt/acceptGroup.js";
import { initProject } from "../scaffold/initProject.js";
import { gateCommand } from "../gate/gateCommand.js";
import type { CliDeps, CliIo, CommandResult, ExitCode } from "./types.js";

export async function main(argv: string[], deps: CliDeps, io: CliIo): Promise<ExitCode> {
  const parsed = parseCommand(argv);
  if (!parsed.ok) {
    io.stdout(renderDocument(parsed.error, argv.includes("--pretty")));
    io.stderr("morph: " + parsed.error.error.message + "\n");
    return 4;
  }
  const command = parsed.command;
  const root = path.resolve(deps.cwd, command.root);

  const detached: DetachedDeps = {
    env: deps.env,
    now: deps.now,
    transport: deps.transport,
    saveState: (s) => saveBatchRecord(root, s),
    saveAnswers: (id, a) => saveBatchAnswers(root, id, a),
  };

  let result: CommandResult;
  try {
    if (command.name === "deck check") {
      result = deckCheckCommand(root, command.deck, command.sliceCapBytes, deps.env);
    } else if (command.name === "plan") {
      result = planCommand(root, command);
    } else if (command.name === "submit") {
      result = await submitDeck(root, command.deck, command.processor, detached);
    } else if (command.name === "collect") {
      result = await collectBatch(root, command.batch, detached);
    } else if (command.name === "primer") {
      result = primerCommand(root, command.write, { env: deps.env, now: deps.now });
    } else if (command.name === "scout") {
      result = await scoutCommand(root, command, deps);
    } else if (command.name === "plan --from-scout") {
      result = planFromScout(root, command);
    } else if (command.name === "review") {
      result = await reviewCommand(root, command, deps);
    } else if (command.name === "card") {
      result = cardBrief(root, command);
    } else if (command.name === "accept") {
      result =
        command.fromRun !== undefined || command.id.includes(",")
          ? await acceptGroup(
              root,
              {
                deck: command.deck,
                ids: command.id.split(","),
                model: command.model,
                fromRun: command.fromRun ?? null,
                pick: command.pick ?? [],
                commit: command.commit,
              },
              deps,
            )
          : await acceptCard(
              root,
              { deck: command.deck, id: command.id, model: command.model ?? "", commit: command.commit },
              deps,
            );
    } else if (command.name === "init") {
      result = initProject(root, command, deps.cwd);
    } else if (command.name === "gate") {
      result = await gateCommand(root, command, { env: deps.env, now: deps.now, readDeck: readDeckFile, builds: checkBuilds });
    } else {
      result = await runCommand(root, command, deps, io.stderr);
    }
  } catch (e) {
    result = classifyThrown(e);
  }

  io.stdout(renderDocument(result.document, command.pretty));
  io.stderr("morph " + command.name + ": exit " + result.code + "\n");
  return result.code;
}
