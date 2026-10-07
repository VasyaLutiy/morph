import fs from "node:fs";
import { expect, test } from "vitest";
import { runCommand } from "../../src/cli/runCommand.js";
import type { CliDeps, RunArgs, RunDocument } from "../../src/cli/types.js";
import type { Card } from "../../src/cards/types.js";
import { tmpRepo, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";

const gitEnv = (home: string): Record<string, string> => ({
  PATH: process.env.PATH ?? "",
  HOME: home,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Ada",
  GIT_AUTHOR_EMAIL: "ada@example.invalid",
  GIT_COMMITTER_NAME: "Ada",
  GIT_COMMITTER_EMAIL: "ada@example.invalid",
});

const card = (
  id: string,
  target: string,
  acceptance: string,
  dependsOn: string[] = []
): Card => ({
  customId: id,
  intent: "generate",
  targets: [target],
  contextSlice: [],
  instruction: "write " + id,
  acceptance,
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn,
});

function writeDeck(side: TmpRoot, cards: Card[]): string {
  side.write("deck.json", JSON.stringify(cards));
  return side.path("deck.json");
}

test("Run Command example 10: a refusing commit hook is archived as a fault", async () => {
  const r = tmpRepo();
  const side = tmpRoot("morph-side-");
  try {
    const base = r.git(["rev-parse", "HEAD"]);
    side.write("answers/a.md", "```ts\nexport const a = 1;\n```\n");
    side.write("answers/b.md", "```ts\nexport const b = 2;\n```\n");
    const deckPath = writeDeck(side, [
      card("a", "out/a.ts", "test -f out/a.ts"),
      card("b", "out/b.ts", "test -f out/b.ts", ["a"]),
    ]);
    fs.writeFileSync(
      r.path(".git/hooks/commit-msg"),
      "#!/bin/sh\nif grep -q '^morph a:' \"$1\"; then echo 'card commits refused' >&2; exit 1; fi\nexit 0\n",
      { mode: 0o755 }
    );
    const deps: CliDeps = {
      env: {
        ...gitEnv(r.root),
        MORPH_PROCESSOR_s_TYPE: "stub",
        MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers"),
      },
      now: () => 1791310149000,
      cwd: r.root,
      transport: null,
    };
    const args: RunArgs = {
      name: "run",
      root: r.root,
      pretty: false,
      deck: deckPath,
      processor: "s",
      runId: "r10",
      deadlineSeconds: 600,
      maxCards: null,
      maxRetryBatches: 1,
    };
    const result = await runCommand(r.root, args, deps);
    expect(result.code).toBe(3);
    const doc = result.document as RunDocument;
    expect(doc.runId).toBe("r10");
    expect(doc.branch).toBe("morph/r10");
    expect(doc.report.fault).toBe(
      "git commit failed (exit 1): card commits refused"
    );
    expect(doc.report.outcomes).toStrictEqual([
      {
        customId: "a",
        status: "skipped",
        reason: "fault",
        attempts: 0,
        winningVariant: null,
        acceptanceLog: "",
        earlierFailures: [],
        commit: null,
        diffstat: null,
      },
      {
        customId: "b",
        status: "skipped",
        reason: "fault",
        attempts: 0,
        winningVariant: null,
        acceptanceLog: "",
        earlierFailures: [],
        commit: null,
        diffstat: null,
      },
    ]);
    expect(doc.archive.ok).toBe(true);
    if (!doc.archive.ok) {
      throw new Error("expected the fault's archive to be ok");
    }
    expect(doc.archive.dir).toBe(".morph/runs/r10");
    const head = r.git(["rev-parse", "HEAD"]);
    expect(doc.archive.commit).toBe(head);
    const reportJson = JSON.parse(
      fs.readFileSync(r.path(".morph/runs/r10/report.json"), "utf8")
    ) as { fault?: string };
    expect(reportJson.fault).toBe(
      "git commit failed (exit 1): card commits refused"
    );
    expect(r.git(["rev-list", "--count", base + "..HEAD"])).toBe("1");
    expect(r.git(["log", "-1", "--format=%B"])).toContain("Morph-Skipped: 2");
    expect(r.git(["branch", "--show-current"])).toBe("morph/r10");
  } finally {
    r.rm();
    side.rm();
  }
});

test("Run Command example 11: an empty deck refuses before any git call", async () => {
  const r = tmpRepo();
  const side = tmpRoot("morph-side-");
  try {
    side.write("deck.json", "[]");
    const deps: CliDeps = {
      env: {
        ...gitEnv(r.root),
        MORPH_PROCESSOR_s_TYPE: "stub",
        MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers"),
      },
      now: () => 1791310149000,
      cwd: r.root,
      transport: null,
    };
    const args: RunArgs = {
      name: "run",
      root: r.root,
      pretty: false,
      deck: side.path("deck.json"),
      processor: "s",
      runId: "r11",
      deadlineSeconds: 600,
      maxCards: null,
      maxRetryBatches: 0,
    };
    const result = await runCommand(r.root, args, deps);
    expect(result).toStrictEqual({
      code: 2,
      document: {
        error: { code: 2, kind: "RefusalError", message: "deck has no cards" },
      },
    });
    expect(r.git(["branch", "--list", "morph/*"])).toBe("");
    expect(fs.existsSync(r.path(".morph"))).toBe(false);
  } finally {
    r.rm();
    side.rm();
  }
});
