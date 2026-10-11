# Debt brief: fmt.x

Write only: `src/x.ts`, `src/y.ts`. Change no other file.
Then: `morph accept --deck d.json --id fmt.x --model <your model> --commit`.

- deck: d.json
- intent: patch
- maxTokens: 9000
- model: none
- dependsOn: base
- last run: 20261102-100000, processor glm53, failed, attempts 2, reason acceptance failed

## Instruction

Fix x and write y.

## Acceptance

<acceptance>
grep -q fixed src/x.ts
</acceptance>

## Last run

<acceptance_log>
== probe
AssertionError: expected 2 to be 1
</acceptance_log>

Answers: `.morph/runs/20261102-100000/answers/fmt.x.r1.v1.answer.txt`, `.morph/runs/20261102-100000/answers/fmt.x.v1.answer.txt`

## Targets now

<file path="src/x.ts">
export const x = 1;
</file>

Target src/y.ts does not exist yet.

## Context slice

<file path="docs/a.md">
# A
</file>

<file path="docs/b.md">
B
</file>

File docs/gone.md is missing.
