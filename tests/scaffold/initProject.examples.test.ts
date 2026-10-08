import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import {
  defaultTemplatesDir,
  fillTemplate,
  initProject,
  listTemplateFiles,
} from "../../src/scaffold/initProject.js";
import { fixturePath, tmpRoot } from "../helpers.js";

const TPL = fixturePath("scaffold/tpl");
const REPO_ROOT = path.resolve(fixturePath("."), "..", "..");

function modeOf(target: string): number {
  return fs.statSync(target).mode & 0o777;
}

function isExecutable(target: string): boolean {
  return (modeOf(target) & 0o111) !== 0;
}

test("Init Project example 1: the Go overlay replaces common's file and every mode is its source's", () => {
  const t = tmpRoot();
  try {
    const root = t.path("acme");
    const result = initProject(
      root,
      { project: "acme", language: "go", module: "example.com/acme", templates: TPL },
      "/",
    );
    expect(result.code).toBe(0);
    expect(result.document).toStrictEqual({
      name: "acme",
      language: "go",
      module: "example.com/acme",
      files: [".gitignore", "README.md", "docs/notes.md", "go.mod", "internal/keep.txt", "tools/hello.sh"],
    });
    expect(fs.readFileSync(path.join(root, "README.md"), "utf8")).toBe("# acme (Go)\n");
    expect(fs.readFileSync(path.join(root, "go.mod"), "utf8")).toBe("module example.com/acme\n\ngo 1.22\n");
    expect(fs.readFileSync(path.join(root, "internal/keep.txt"), "utf8")).toBe("example.com/acme/internal go\n");
    const sources: Record<string, string> = {
      ".gitignore": path.join(TPL, "common", ".gitignore"),
      "README.md": path.join(TPL, "go", "README.md"),
      "docs/notes.md": path.join(TPL, "common", "docs/notes.md"),
      "go.mod": path.join(TPL, "go", "go.mod"),
      "internal/keep.txt": path.join(TPL, "go", "internal/keep.txt"),
      "tools/hello.sh": path.join(TPL, "common", "tools/hello.sh"),
    };
    for (const [rel, source] of Object.entries(sources)) {
      expect(modeOf(path.join(root, rel))).toBe(modeOf(source));
    }
    expect(isExecutable(path.join(root, "tools/hello.sh"))).toBe(true);
  } finally {
    t.rm();
  }
});

test("Init Project example 2: a relative templates dir resolves against cwd and --module defaults to the project", () => {
  const t = tmpRoot();
  try {
    const result = initProject(
      t.root,
      { project: "beta_svc", language: "python", module: null, templates: "tpl" },
      fixturePath("scaffold"),
    );
    expect(result.code).toBe(0);
    expect(result.document).toStrictEqual({
      name: "beta_svc",
      language: "python",
      module: "beta_svc",
      files: [".gitignore", "README.md", "docs/notes.md", "pyproject.toml", "tools/hello.sh"],
    });
    expect(t.read("README.md")).toBe("# beta_svc\n\nA python project, module beta_svc.\n");
    expect(t.read("pyproject.toml")).toBe("[project]\nname = \"beta_svc\"\n");
    expect(t.read("docs/notes.md")).toBe(
      "Keep {{ name }}, {{other}}, ${{ env.HOME }} and {{join .Imports}} as they are; beta_svcbeta_svc.\n",
    );
  } finally {
    t.rm();
  }
});

test("Init Project example 3: fillTemplate replaces the three placeholders in one pass", () => {
  expect(
    fillTemplate("{{name}}:{{module}}:{{language}}", {
      name: "{{module}}",
      module: "x/y",
      language: "go",
    }),
  ).toBe("{{module}}:x/y:go");
  expect(
    fillTemplate("{name} {{Name}} {{name}", { name: "n", module: "m", language: "l" }),
  ).toBe("{name} {{Name}} {{name}");
});

test("Init Project example 4: every refusal leaves the file system as it was", () => {
  const t = tmpRoot();
  try {
    t.write("b.txt", "b\n");
    t.write(".a", "a\n");
    const notEmpty = initProject(
      t.root,
      { project: "acme", language: "go", module: null, templates: TPL },
      "/",
    );
    expect(notEmpty).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "RefusalError",
          message: "target directory is not empty (first entry: .a)",
        },
      },
    });
    expect(fs.readdirSync(t.root).sort()).toStrictEqual([".a", "b.txt"]);
    expect(t.read(".a")).toBe("a\n");
    expect(t.read("b.txt")).toBe("b\n");

    const file = t.write("f.txt", "x\n");
    const notDirectory = initProject(
      file,
      { project: "acme", language: "go", module: null, templates: TPL },
      "/",
    );
    expect(notDirectory).toStrictEqual({
      code: 2,
      document: {
        error: { code: 2, kind: "RefusalError", message: "target is not a directory" },
      },
    });

    const noLanguage = initProject(
      t.path("ts"),
      { project: "acme", language: "typescript", module: null, templates: TPL },
      "/",
    );
    expect(noLanguage).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "RefusalError",
          message: "template folder not found: typescript",
        },
      },
    });

    const noCommon = initProject(
      t.path("missing"),
      { project: "acme", language: "go", module: null, templates: "nope" },
      t.root,
    );
    expect(noCommon).toStrictEqual({
      code: 2,
      document: {
        error: { code: 2, kind: "RefusalError", message: "template folder not found: common" },
      },
    });
    expect(t.exists("ts")).toBe(false);
    expect(t.exists("missing")).toBe(false);
  } finally {
    t.rm();
  }
});

test("Init Project example 5: templates null finds the repository's templates/ and fills the real tree", () => {
  const t = tmpRoot();
  try {
    expect(defaultTemplatesDir()).toBe(path.resolve(REPO_ROOT, "templates"));
    const templates = defaultTemplatesDir();
    const expected = Array.from(
      new Set([
        ...listTemplateFiles(path.join(templates, "common")),
        ...listTemplateFiles(path.join(templates, "go")),
      ]),
    ).sort();
    const root = t.path("gx");
    const result = initProject(
      root,
      { project: "gx", language: "go", module: "example.com/gx", templates: null },
      "/",
    );
    expect(result.code).toBe(0);
    expect(result.document).toStrictEqual({
      name: "gx",
      language: "go",
      module: "example.com/gx",
      files: expected,
    });
    for (const rel of [
      "CLAUDE.md",
      "docs/AUTONOMY.md",
      "go.mod",
      "internal/testhelp/testhelp.go",
      "decks/tools/guard.mjs",
      "tools/tg.sh",
    ]) {
      expect(expected).toContain(rel);
    }
    expect(fs.readFileSync(path.join(root, "go.mod"), "utf8").startsWith("module example.com/gx\n")).toBe(
      true,
    );
    for (const rel of expected) {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      expect(text.includes("{{name}}")).toBe(false);
      expect(text.includes("{{module}}")).toBe(false);
      expect(text.includes("{{language}}")).toBe(false);
    }
    expect(isExecutable(path.join(root, "tools/tg.sh"))).toBe(true);
    expect(listTemplateFiles(path.join(TPL, "common"))).toStrictEqual([
      ".gitignore",
      "README.md",
      "docs/notes.md",
      "tools/hello.sh",
    ]);
    expect(listTemplateFiles(t.path("none"))).toStrictEqual([]);
  } finally {
    t.rm();
  }
});
