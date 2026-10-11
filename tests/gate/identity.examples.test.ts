import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { main } from "../../src/cli/main.js";
import { checkIdentity } from "../../src/gate/identity.js";
import type { IdentityEntry } from "../../src/gate/identity.js";
import { fixtureJson, fixturePath } from "../helpers.js";

const ROOT = path.resolve(fixturePath("."), "..", "..");

const env = (): Record<string, string> => ({
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
});

const corpus = (): IdentityEntry[] => fixtureJson("identity/corpus.json") as IdentityEntry[];

const plan = (argv: string[]): Promise<number> =>
  main(
    argv,
    { env: env(), now: () => 0, cwd: "/", transport: null },
    { stdout: () => {}, stderr: () => {} },
  );

const goMini = (): IdentityEntry => corpus().filter((e) => e.name === "go-mini")[0];

function gitStatus(): string {
  return execFileSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
  });
}

test(
  "Check Identity example 1: the whole corpus is cut byte for byte",
  async () => {
    const entries = corpus();
    expect(entries.map((e) => [e.name, e.bytes])).toStrictEqual([
      ["go-mini", 75416],
      ["go-p7b", 100388],
      ["p15", 1247586],
      ["p21c", 362610],
      ["p22a", 337622],
    ]);
    const before = gitStatus();
    const result = await checkIdentity(ROOT, entries, { env: env(), plan });
    expect(result).toStrictEqual({
      rows: entries.map((e) => ({
        name: e.name,
        code: 0,
        bytes: e.bytes,
        sha256: e.sha256,
        ok: true,
      })),
      errors: [],
    });
    expect(gitStatus()).toBe(before);
  },
  120000,
);

test(
  "Check Identity example 2: a changed planner output and a red plan",
  async () => {
    const entry = goMini();
    const changed = async (argv: string[]): Promise<number> => {
      fs.writeFileSync(argv[argv.indexOf("--out") + 1], "x\n");
      return 0;
    };
    const changedResult = await checkIdentity(ROOT, [entry], { env: env(), plan: changed });
    expect(changedResult).toStrictEqual({
      rows: [
        {
          name: "go-mini",
          code: 0,
          bytes: 2,
          sha256: "73cb3858a687a8494ca3323053016282f3dad39d42cf62ca4e79dda2aac7d9ac",
          ok: false,
        },
      ],
      errors: ["go-mini: 2 B, sha256 73cb3858a687; the corpus has 75416 B, sha256 3568d65a52ff"],
    });
    const red = async (): Promise<number> => 2;
    const redResult = await checkIdentity(ROOT, [entry], { env: env(), plan: red });
    expect(redResult).toStrictEqual({
      rows: [{ name: "go-mini", code: 2, bytes: 0, sha256: "", ok: false }],
      errors: ["go-mini: plan exit 2"],
    });
  },
  120000,
);

test(
  "Check Identity example 3: the corpus installs the tools and the commit must exist",
  async () => {
    const bare: IdentityEntry = { ...goMini(), install: {} };
    const result = await checkIdentity(ROOT, [bare], { env: env(), plan });
    expect(result).toStrictEqual({
      rows: [{ name: "go-mini", code: 4, bytes: 0, sha256: "", ok: false }],
      errors: ["go-mini: plan exit 4"],
    });
    const absent: IdentityEntry = {
      ...goMini(),
      install: {},
      commit: "0000000000000000000000000000000000000000",
    };
    await expect(checkIdentity(ROOT, [absent], { env: env(), plan })).rejects.toThrow(
      /^git checkout failed \(exit /,
    );
  },
  120000,
);
