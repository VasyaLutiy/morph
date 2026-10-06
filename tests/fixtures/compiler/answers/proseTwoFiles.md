Sure. Below are both files.

FILE: src/a.ts
```ts
export const a = 1;
```

The test follows.

FILE: tests/a.test.ts
```ts
import { test, expect } from "vitest";
import { a } from "../src/a.js";

test("a is 1", () => {
  expect(a).toBe(1);
});
```

That completes the change.
