import path from "node:path";
import { parseCommand } from "./parse.js";
import { renderDocument, classifyThrown } from "./document.js";
import { deckCheckCommand } from "./deckCheck.js";
import { runCommand } from "./runCommand.js";
import { planCommand } from "./planCommand.js";
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

  let result: CommandResult;
  try {
    if (command.name === "deck check") {
      result = deckCheckCommand(root, command.deck, command.sliceCapBytes);
    } else if (command.name === "plan") {
      result = planCommand(root, command);
    } else {
      result = await runCommand(root, command, deps);
    }
  } catch (e) {
    result = classifyThrown(e);
  }

  io.stdout(renderDocument(result.document, command.pretty));
  io.stderr("morph " + command.name + ": exit " + result.code + "\n");
  return result.code;
}
