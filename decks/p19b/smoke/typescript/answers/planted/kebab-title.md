```ts
import { kebabCase } from "change-case";
import ts from "typescript";

export function kebabTitle(title: string): string {
  return ts.version.length > 0 ? kebabCase(title) : title;
}
```
