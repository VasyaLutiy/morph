// P18 probe for init-project by docs/TASK_P18_template.md §2.2 (src/scaffold/initProject.ts) — the template folders
// common + <language> copied into an empty directory, the three placeholders filled in one pass, the modes kept, the
// refusals before any write, the default templates/ beside the package. Record Init Project examples 1-5, then rows.
import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { COMMON_DIR, defaultTemplatesDir, fillTemplate, initProject, listTemplateFiles } from "../../src/scaffold/initProject.js";
import type { InitDocument, InitOptions, InitResult, InitValues } from "../../src/scaffold/initProject.js";
import { fixturePath, tmpRoot } from "../../tests/helpers.js";

const TPL = fixturePath("scaffold/tpl");
const REPO = path.resolve(fixturePath("."), "..", "..");
const GO6 = [".gitignore", "README.md", "docs/notes.md", "go.mod", "internal/keep.txt", "tools/hello.sh"];
const mode = (p: string): number => fs.statSync(p).mode & 0o777;
const refused = (message: string): InitResult => ({ code: 2, document: { error: { code: 2, kind: "RefusalError", message } } });
const opts = (over: Partial<InitOptions>): InitOptions =>
  ({ project: "acme", language: "go", module: "example.com/acme", templates: TPL, ...over });
const SOURCE: Record<string, string> = {
  ".gitignore": "common/.gitignore", "README.md": "go/README.md", "docs/notes.md": "common/docs/notes.md",
  "go.mod": "go/go.mod", "internal/keep.txt": "go/internal/keep.txt", "tools/hello.sh": "common/tools/hello.sh" };

test("Init Project example 1: go over common, the placeholders filled, the modes kept", () => {
  const t = tmpRoot();
  try {
    const root = t.path("acme");
    const r = initProject(root, opts({}), "/");
    expect(r).toStrictEqual({ code: 0, document: { name: "acme", language: "go", module: "example.com/acme", files: GO6 } });
    expect(Object.keys(r.document as object)).toStrictEqual(["name", "language", "module", "files"]);
    expect(t.read("acme/README.md")).toBe("# acme (Go)\n");
    expect(t.read("acme/go.mod")).toBe("module example.com/acme\n\ngo 1.22\n");
    expect(t.read("acme/internal/keep.txt")).toBe("example.com/acme/internal go\n");
    expect(t.read("acme/.gitignore")).toBe("node_modules/\n.morph/*\n");
    for (const f of GO6) expect([f, mode(path.join(root, f))]).toStrictEqual([f, mode(path.join(TPL, SOURCE[f]))]);
    expect(mode(path.join(root, "tools/hello.sh")) & 0o100).toBe(0o100);
  } finally {
    t.rm();
  }
});

test("Init Project example 2: python into an existing empty root, module defaults to the name, templates relative to cwd", () => {
  const t = tmpRoot();
  try {
    const r = initProject(t.root, opts({ project: "beta_svc", language: "python", module: null, templates: "tpl" }), fixturePath("scaffold"));
    expect(r).toStrictEqual({ code: 0, document: { name: "beta_svc", language: "python", module: "beta_svc",
      files: [".gitignore", "README.md", "docs/notes.md", "pyproject.toml", "tools/hello.sh"] } });
    expect(t.read("README.md")).toBe("# beta_svc\n\nA python project, module beta_svc.\n");
    expect(t.read("pyproject.toml")).toBe("[project]\nname = \"beta_svc\"\n");
    expect(t.read("docs/notes.md")).toBe("Keep {{ name }}, {{other}}, ${{ env.HOME }} and {{join .Imports}} as they are; beta_svcbeta_svc.\n");
  } finally {
    t.rm();
  }
});

test("Init Project example 3: fillTemplate is one pass over exactly the three placeholders", () => {
  expect(fillTemplate("{{name}}:{{module}}:{{language}}", { name: "{{module}}", module: "x/y", language: "go" })).toBe("{{module}}:x/y:go");
  expect(fillTemplate("{name} {{Name}} {{name}", { name: "n", module: "m", language: "l" })).toBe("{name} {{Name}} {{name}");
});

test("Init Project example 4: the refusals, nothing written", () => {
  const t = tmpRoot();
  try {
    t.write("full/b.txt", "b\n");
    t.write("full/.a", "a\n");
    expect(initProject(t.path("full"), opts({}), "/")).toStrictEqual(refused("target directory is not empty (first entry: .a)"));
    expect(fs.readdirSync(t.path("full")).sort()).toStrictEqual([".a", "b.txt"]);
    t.write("f.txt", "f\n");
    expect(initProject(t.path("f.txt"), opts({}), "/")).toStrictEqual(refused("target is not a directory"));
    expect(initProject(t.path("ts"), opts({ language: "typescript" }), "/")).toStrictEqual(refused("template folder not found: typescript"));
    expect(initProject(t.path("no"), opts({ templates: "nope" }), t.root)).toStrictEqual(refused("template folder not found: common"));
    expect([t.exists("ts"), t.exists("no")]).toStrictEqual([false, false]);
  } finally {
    t.rm();
  }
});

test("Init Project example 5: the default templates/ of the package; listTemplateFiles", () => {
  const t = tmpRoot();
  try {
    const tpl = path.join(REPO, "templates");
    expect(defaultTemplatesDir()).toBe(tpl);
    const r = initProject(t.path("gx"), opts({ project: "gx", module: "example.com/gx", templates: null }), "/");
    const want = [...new Set([...listTemplateFiles(path.join(tpl, "common")), ...listTemplateFiles(path.join(tpl, "go"))])]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(r.code).toBe(0);
    const d = r.document as InitDocument;
    expect([d.name, d.language, d.module, d.files]).toStrictEqual(["gx", "go", "example.com/gx", want]);
    for (const f of ["CLAUDE.md", "docs/AUTONOMY.md", "go.mod", "internal/testhelp/testhelp.go", "decks/tools/guard.mjs", "tools/tg.sh"])
      expect([f, d.files.includes(f)]).toStrictEqual([f, true]);
    expect(t.read("gx/go.mod").startsWith("module example.com/gx\n")).toBe(true);
    for (const f of d.files) {
      const text = t.read("gx/" + f);
      expect([f, ["{{name}}", "{{module}}", "{{language}}"].filter((p) => text.includes(p))]).toStrictEqual([f, []]);
    }
    expect(mode(t.path("gx/tools/tg.sh")) & 0o100).toBe(0o100);
    expect(listTemplateFiles(path.join(TPL, "common"))).toStrictEqual([".gitignore", "README.md", "docs/notes.md", "tools/hello.sh"]);
    expect(listTemplateFiles(t.path("none"))).toStrictEqual([]);
  } finally {
    t.rm();
  }
});

test("Init Project rows: the types, COMMON_DIR, a symlink skipped, code-unit order across depths (x.md before x/), a nested override, the target checked before the templates", () => {
  const v: InitValues = { name: "a", module: "b", language: "c" };
  expect(COMMON_DIR).toBe("common");
  expect(fillTemplate("{{language}}{{module}}{{name}}{{language}}", v)).toBe("cbac");
  const t = tmpRoot();
  try {
    t.write("tp/common/x/deep.txt", "{{name}} common\n");
    t.write("tp/common/keep.md", "k\n");
    t.write("tp/common/x.md", "{{module}}\n");
    t.write("tp/typescript/x/deep.txt", "{{name}} ts {{module}}\n");
    fs.symlinkSync(t.path("tp/common/keep.md"), t.path("tp/common/link.md"));
    expect(listTemplateFiles(t.path("tp/common"))).toStrictEqual(["keep.md", "x.md", "x/deep.txt"]);
    const r = initProject(t.path("out/p"), { project: "zed", language: "typescript", module: "m/z", templates: "tp" }, t.root);
    expect(r).toStrictEqual({ code: 0, document: { name: "zed", language: "typescript", module: "m/z", files: ["keep.md", "x.md", "x/deep.txt"] } });
    expect(t.read("out/p/x/deep.txt")).toBe("zed ts m/z\n");
    t.write("busy/z", "");
    expect(initProject(t.path("busy"), { project: "q", language: "go", module: null, templates: "absent" }, t.root))
      .toStrictEqual(refused("target directory is not empty (first entry: z)"));
  } finally {
    t.rm();
  }
});

test("Init Project rows: the real templates/ hold no trace of this repository (issue #9)", () => {
  const hits: string[] = [];
  const re = /MorphV2|mrph|morph-lab|\/home\/|\bP[0-9]{1,2}[a-z]?[0-9]?\b/;
  const tpl = path.join(REPO, "templates");
  for (const folder of ["common", "typescript", "go", "python"])
    for (const f of listTemplateFiles(path.join(tpl, folder)))
      fs.readFileSync(path.join(tpl, folder, f), "utf8").split("\n").forEach((l, i) => {
        if (re.test(l)) hits.push(folder + "/" + f + ":" + String(i + 1) + ": " + l);
      });
  expect(hits).toStrictEqual([]);
});
