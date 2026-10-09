```ts
import { METRE, toMetres } from "../units/convert.js";

// Length Line after the re-cut: it passes the unit on.
export function lengthLine(label: string, value: number, unit: "cm" | "mm"): string {
  return `${label}: ${toMetres(value, unit)} ${METRE}`;
}
```
