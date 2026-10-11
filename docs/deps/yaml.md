# yaml 2.9.1 — API digest (TypeScript, ESM)

The package `yaml` (eemeli/yaml), declared in `contour.yaml` (`System.dependencies`) and used by Component `contour`
only. Written from the package's own `README.md` and `dist/public-api.d.ts`, `dist/errors.d.ts`, `dist/options.d.ts`
(node_modules/yaml, 2.9.1); every output line below was run on that version. YAML 1.2 core schema by default.

## Import

```ts
import { parse, stringify, parseDocument, YAMLParseError } from "yaml";   // named exports; no default import needed
```

## Signatures

```ts
function parse(src: string, options?: ParseOptions & DocumentOptions & SchemaOptions & ToJSOptions): any;
function parse(src: string, reviver: Reviver, options?: ...): any;
function stringify(value: any, options?: DocumentOptions & SchemaOptions & ParseOptions & CreateNodeOptions & ToStringOptions): string;
function parseDocument(source: string, options?: ParseOptions & DocumentOptions & SchemaOptions): Document.Parsed;
function parseAllDocuments(source: string, options?: ...): Document.Parsed[] | EmptyStream;

class YAMLError extends Error {
  name: "YAMLParseError" | "YAMLWarning";
  code: ErrorCode;                  // "DUPLICATE_KEY" | "BAD_INDENT" | "MULTIPLE_DOCS" | "TAB_AS_INDENT" | ...
  message: string;                  // first line "<what> at line <l>, column <c>:", then a source excerpt
  pos: [number, number];            // character offsets in src
  linePos?: [LinePos] | [LinePos, LinePos];   // LinePos = { line: number; col: number }, 1-based
}
class YAMLParseError extends YAMLError {}
class YAMLWarning extends YAMLError {}
```

- `parse` returns `any`: in strict TypeScript assign it to `unknown` and narrow (`typeof`, `Array.isArray`).
- `parse` **throws** the first `YAMLParseError` (one document only; a second document → code `MULTIPLE_DOCS`).
  Warnings go to `console.warn` unless `logLevel: "error"` is given.
- `parseDocument` never throws on a syntax error: `doc.errors: YAMLParseError[]`, `doc.warnings`, `doc.toJS()` the
  value (the last duplicate key wins there).
- `stringify` always ends with `"\n"`; strings that would read back as another type are quoted.

## Options that matter here

| option | default | effect |
|---|---|---|
| `uniqueKeys` | `true` | a repeated mapping key is the error `DUPLICATE_KEY` |
| `prettyErrors` | `true` | `message` gets the "at line, column" suffix and the excerpt; `linePos` is set |
| `strict` | `true` | stricter than the spec where the spec is ambiguous |
| `version` | `"1.2"` | `"1.1"` turns on `yes`/`no`/`on` booleans, sexagesimals, and so on |
| `schema` | `"core"` | `"failsafe"` keeps every scalar a string; `"json"` the JSON subset |
| `maxAliasCount` | `100` | an alias bomb is refused (`RESOURCE_EXHAUSTION`) |

## Values (measured, yaml 2.9.1, core schema)

```text
parse("a: 1\nb: [x, \"6.0\", 6.0]\n")   → {"a":1,"b":["x","6.0",6]}     6.0 unquoted is the NUMBER 6
parse("")                              → null                            (also a comment-only text)
parse("on: yes\nd: 2026-10-08\n")      → {"on":"yes","d":"2026-10-08"}   no 1.1 booleans, no Date
stringify({a: [1, 2], b: "x: y"})      → "a:\n  - 1\n  - 2\nb: \"x: y\"\n"
```

## Errors (measured)

```text
parse("a: 1\na: 2\n")  throws YAMLParseError
  name "YAMLParseError", code "DUPLICATE_KEY",
  message's first line "Map keys must be unique at line 2, column 1:",
  linePos [{"line":2,"col":1},{"line":2,"col":2}]
parse("a: [1\n")       throws, code "BAD_INDENT",
  first line "Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1:"
parseDocument("a: 1\na: 2\n").errors.length → 1 (code DUPLICATE_KEY); .toJS() → {"a":2}
```

## One example (how MorphV2 uses it)

```ts
import { parse } from "yaml";

function firstLine(m: string): string {
  const i = m.indexOf("\n");
  return i === -1 ? m : m.slice(0, i);
}

export function readYaml(text: string, name: string): { ok: true; doc: unknown } | { ok: false; error: string } {
  let doc: unknown;
  try {
    doc = parse(text);                                   // throws YAMLParseError on bad YAML
  } catch (e) {
    return { ok: false, error: "cannot parse " + name + ": " + firstLine(e instanceof Error ? e.message : String(e)) };
  }
  return { ok: true, doc };
}
// readYaml("a: 1\na: 2\n", "x.yaml") → {ok: false, error: "cannot parse x.yaml: Map keys must be unique at line 2, column 1:"}
```
