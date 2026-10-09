```ts
import { test, expect } from "vitest";
import { toMetres } from "../../src/units/convert.js";

test("To Metres example 1", () => expect(toMetres(250, "cm")).toBe(2.5));
test("To Metres example 2", () => expect(toMetres(1500, "mm")).toBe(1.5));
```
