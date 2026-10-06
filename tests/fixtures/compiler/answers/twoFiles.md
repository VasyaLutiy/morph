FILE: src/a.ts
```ts
export const a = 1;
```

FILE: tests/a.test.ts
```ts
import { test, expect } from "vitest";
import { a } from "../src/a.js";

test("a is 1", () => {
  expect(a).toBe(1);
});
```
