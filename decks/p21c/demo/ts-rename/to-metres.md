```ts
// To Metres after the re-cut: the unit is an argument.
export const METRE = "m";

export function toMetres(value: number, unit: "cm" | "mm"): number {
  return unit === "cm" ? value / 100 : value / 1000;
}
```
