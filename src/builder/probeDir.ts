import { heredoc } from "./steps.js";

export function cardTsconfig(exclude: readonly string[]): string {
  const tsconfig: { extends: string; include: string[]; exclude?: string[] } = {
    extends: "../../tsconfig.json",
    include: ["../../src", "../../tests", "./*.probe.ts"],
  };
  if (exclude.length > 0) {
    tsconfig.exclude = exclude.map((path) => "../../" + path);
  }
  return JSON.stringify(tsconfig, null, 2) + "\n";
}

export function vitestConfig(id: string): string {
  return (
    'import { defineConfig } from "vitest/config";\n' +
    'import { fileURLToPath } from "node:url";\n' +
    "export default defineConfig({\n" +
    '  root: fileURLToPath(new URL("../..", import.meta.url)),\n' +
    '  test: { environment: "node", include: ["probe/' +
    id +
    '/**/*.probe.ts"],\n' +
    '    setupFiles: ["tests/setup.ts"], chaiConfig: { truncateThreshold: 200 } },\n' +
    "});\n"
  );
}

export function probeDir(
  id: string,
  guard: string,
  firstdiff: string,
  probe: string | null,
  exclude: readonly string[],
): string {
  let out =
    "P=$PWD/probe/" +
    id +
    "; rm -rf $P; mkdir -p $P; trap 'rm -rf $P' EXIT\n";
  out += heredoc("$P/guard.mjs", guard, "MORPH_GUARD_EOF");
  out += heredoc("$P/probe.config.mts", vitestConfig(id), "MORPH_CONF_EOF");
  out += heredoc("$P/tsconfig.card.json", cardTsconfig(exclude), "MORPH_TSCONF_EOF");
  out += heredoc("$P/firstdiff.mjs", firstdiff, "MORPH_FIRSTDIFF_EOF");
  if (probe !== null) {
    out += heredoc("$P/" + id + ".probe.ts", probe, "MORPH_PROBE_EOF");
  }
  return out;
}
