// P22b probe for check-identity by docs/TASK_P22b_mutants.md §2.2 (src/gate/identity.ts) — byte identity of the committed corpus.
// Record Check Identity examples 1-3, then rows.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test, expect } from "vitest";
import { checkIdentity } from "../../src/gate/identity.js";
import type { IdentityEntry } from "../../src/gate/identity.js";
import { main } from "../../src/cli/main.js";
import { fixtureJson, fixturePath } from "../../tests/helpers.js";

const ROOT = path.resolve(fixturePath("."), "..", "..");
const corpus = (): IdentityEntry[] => fixtureJson("identity/corpus.json") as IdentityEntry[];
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const plan = (argv: string[]): Promise<number> =>
  main(argv, { env: env(), now: () => 0, cwd: "/", transport: null }, { stdout: () => {}, stderr: () => {} });
const status = (): string => execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
const goMini = (): IdentityEntry => corpus().filter((e) => e.name === "go-mini")[0];

test("Check Identity example 1: the committed corpus cuts byte for byte", async () => {
  const before = status();
  const r = await checkIdentity(ROOT, corpus(), { env: env(), plan });
  expect(r.errors).toStrictEqual([]);
  expect(r.rows.map((x) => x.name + " " + x.code + " " + x.bytes + " " + x.ok)).toStrictEqual([
    "go-mini 0 75416 true", "go-p7b 0 100388 true", "p15 0 1247586 true", "p21c 0 362610 true", "p22a 0 337622 true"]);
  expect(r.rows.map((x) => x.sha256)).toStrictEqual(corpus().map((e) => e.sha256));
  expect(status()).toBe(before);
}, 120000);

test("Check Identity example 2: a changed planner output is red", async () => {
  const x = await checkIdentity(ROOT, [goMini()], { env: env(), plan: async (argv) => { fs.writeFileSync(argv[argv.indexOf("--out") + 1], "x\n"); return 0; } });
  expect(x).toStrictEqual({ rows: [{ name: "go-mini", code: 0, bytes: 2, sha256: "73cb3858a687a8494ca3323053016282f3dad39d42cf62ca4e79dda2aac7d9ac", ok: false }],
    errors: ["go-mini: 2 B, sha256 73cb3858a687; the corpus has 75416 B, sha256 3568d65a52ff"] });
  expect(await checkIdentity(ROOT, [goMini()], { env: env(), plan: async () => 2 })).toStrictEqual({
    rows: [{ name: "go-mini", code: 2, bytes: 0, sha256: "", ok: false }], errors: ["go-mini: plan exit 2"] });
}, 120000);

test("Check Identity example 3: a tree without its install, an unknown commit", async () => {
  expect(await checkIdentity(ROOT, [{ ...goMini(), install: {} }], { env: env(), plan })).toStrictEqual({
    rows: [{ name: "go-mini", code: 4, bytes: 0, sha256: "", ok: false }], errors: ["go-mini: plan exit 4"] });
  await expect(checkIdentity(ROOT, [{ ...goMini(), commit: "0000000000000000000000000000000000000000" }], { env: env(), plan }))
    .rejects.toThrow(/^git checkout failed \(exit /);
}, 120000);

test("rows: each entry has its own out file; equal bytes with another sha256 are not ok", async () => {
  let calls = 0;
  const two = await checkIdentity(ROOT, [goMini(), goMini()], { env: env(), plan: async (argv) => {
    calls += 1; if (calls === 1) fs.writeFileSync(argv[argv.indexOf("--out") + 1], "x\n"); return calls === 1 ? 0 : 2; } });
  expect(two.rows.map((x) => [x.code, x.bytes, x.sha256.slice(0, 12)])).toStrictEqual([[0, 2, "73cb3858a687"], [2, 0, ""]]);
  const same = Buffer.alloc(75416, 120);
  const sha = crypto.createHash("sha256").update(same).digest("hex");
  const r = await checkIdentity(ROOT, [goMini()], { env: env(), plan: async (argv) => { fs.writeFileSync(argv[argv.indexOf("--out") + 1], same); return 0; } });
  expect(r).toStrictEqual({ rows: [{ name: "go-mini", code: 0, bytes: 75416, sha256: sha, ok: false }],
    errors: ["go-mini: 75416 B, sha256 " + sha.slice(0, 12) + "; the corpus has 75416 B, sha256 3568d65a52ff"] });
}, 120000);
