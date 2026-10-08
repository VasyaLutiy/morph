# change-case 5.4.4 — API digest (TypeScript, ESM)

Declared in `contour.yaml` (`System.dependencies`) and used by Component `text` only. Written from the package's own
`dist/index.d.ts` and README at 5.4.4; every value below was run on 5.4.4 (Node 22). ESM only (`"type": "module"`), its
own types, no dependencies. Installed by `npm ci` from the committed `package-lock.json`; never install anything.

## Import

```ts
import { kebabCase } from "change-case";      // named exports only; there is no default export
```

## Signatures

```ts
export type Locale = string[] | string | false | undefined;   // false: no locale; undefined: the host's
export interface Options {
  locale?: Locale;
  split?: (value: string) => string[];
  delimiter?: string;
  prefixCharacters?: string;
  suffixCharacters?: string;
}
export declare function split(value: string): string[];           // the words of any cased input
export declare function kebabCase(input: string, options?: Options): string;   // "foo-bar"
export declare function snakeCase(input: string, options?: Options): string;   // "foo_bar"
export declare function camelCase(input: string, options?: Options & { mergeAmbiguousCharacters?: boolean }): string;
export declare function noCase(input: string, options?: Options): string;      // "foo bar"
// also: pascalCase, pascalSnakeCase, capitalCase, constantCase, dotCase, pathCase, sentenceCase, trainCase
```

Words are split on case changes (`fooBar`, `XMLHttp` → `XML`, `Http`), white space and every character that is not a
letter or a digit; empty pieces are dropped; each case function lower- or upper-cases the words and joins them.

## Values (measured, 5.4.4)

```text
kebabCase("Hello World")          → "hello-world"
kebabCase("fooBarBaz")            → "foo-bar-baz"
kebabCase("XMLHttpRequest")       → "xml-http-request"
kebabCase("  Morph -- Cards 2 ")  → "morph-cards-2"
kebabCase("version 1.2.3")        → "version-1-2-3"
kebabCase("")                     → ""
snakeCase("XMLHttpRequest")       → "xml_http_request"
camelCase("  Morph -- Cards 2 ")  → "morphCards_2"
split("  Morph -- Cards 2 ")      → ["Morph", "Cards", "2"]
```

## One example

```ts
import { kebabCase } from "change-case";

export function anchor(heading: string): string {
  return "#" + kebabCase(heading);          // anchor("Release Notes 2") === "#release-notes-2"
}
```
