```ts
import { test, expect } from "vitest";
import { lengthLine } from "../../src/report/line.js";

test("Length Line example 1", () => expect(lengthLine("shelf", 250, "cm")).toBe("shelf: 2.5 m"));
test("Length Line example 2", () => expect(lengthLine("rod", 1500, "mm")).toBe("rod: 1.5 m"));
```
