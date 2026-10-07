// P11c probe for run-acceptance by docs/TASK_P11c_runner.md §2.2 (issue #5 finding 5) — the child env is the given env
// minus every key whose upper-cased name starts with "MORPH_PROCESSOR_" or ends in "_KEY" or "_TOKEN", with NO_COLOR=1 and CI=1 laid over
// it; the caller's object is not changed. Record Run Acceptance example 5, then the §2.2 rows.
import { test, expect } from "vitest";
import { runAcceptance } from "../../src/acceptance/run.js";
import { tmpRoot } from "../../tests/helpers.js";

const ENV: Record<string, string> = {
  PATH: "/usr/bin:/bin", MORPH_PROCESSOR_x_API_KEY: "k1", MORPH_PROCESSOR_x_MODEL: "m/x", OPENROUTER_API_KEY: "k2",
  GH_TOKEN: "t3", KEYBOARD: "us", TOKENS_LEFT: "7" };

test("Run Acceptance example 5: no processor key and no *_KEY / *_TOKEN reaches the acceptance", async () => {
  const t = tmpRoot("morph-p11c-");
  try {
    const got = await runAcceptance("env", t.root, { env: { ...ENV } });
    expect(`${got.exit} ${got.timedOut}`, "exit").toBe("0 false");
    const names = got.log.split("\n").map((l) => l.split("=")[0]);
    expect(["KEYBOARD", "TOKENS_LEFT", "PATH", "NO_COLOR", "CI"].every((n) => names.includes(n)), got.log).toBe(true);
    expect(["MORPH_PROCESSOR_", "k1", "m/x", "k2", "t3", "_KEY=", "_TOKEN="].filter((s) => got.log.includes(s)), "leaks").toStrictEqual([]);
  } finally {
    t.rm();
  }
});

test("§2.2 rows: the exact rule, case-insensitive; NO_COLOR and CI still forced; the caller's env unchanged", async () => {
  const t = tmpRoot("morph-p11c-");
  try {
    const env: Record<string, string> = { ...ENV, MORPH_PROCESSOR_: "p", MY_KEY_ID: "8", api_key: "lo", morph_processor_y_type: "st", Gh_Token: "gt", SSH_KEY: "s", NO_COLOR: "0",
      MRPH_PROCESSOR_ds_API_KEY: "m", XTOKEN: "9", KEY: "10" };
    const copy = { ...env };
    const cmd = 'echo "${MORPH_PROCESSOR_x_MODEL-none} ${MORPH_PROCESSOR_-none} ${SSH_KEY-none} ${MRPH_PROCESSOR_ds_API_KEY-none} ' +
      '${MY_KEY_ID-none} ${api_key-none} ${morph_processor_y_type-none} ${Gh_Token-none} ${XTOKEN-none} ${KEY-none} $KEYBOARD $TOKENS_LEFT $NO_COLOR $CI"';
    const got = await runAcceptance(cmd, t.root, { env });
    expect(got.log, "values").toBe("none none none none 8 none none none 9 10 us 7 1 1\n");
    expect(env, "the caller's env").toStrictEqual(copy);
  } finally {
    t.rm();
  }
});
