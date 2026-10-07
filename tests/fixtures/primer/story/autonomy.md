# Autonomous mode (from P3 on, on the VPS)

## State at handoff (07.10, after the P11b2 smoke)

P0–P11c2 and P11b2 merged; `main` = origin = VPS. Issues #3, #4, #5 closed. **Processor `ds`** (maxTokens ×3 by
`decks/tools/scale_tokens.py`; glm53 the fallback). P11b2 (Component `batches`: `morph submit` / `morph collect`,
9/9 on ds, $0.1183) and its smoke are green: submit in one process, collect in a second (13 tries, 733 s), stub replay
2/2, on `z-ai/glm-5.3:batch`; the ds batch slug `deepseek/deepseek-v4.1-flash:batch` is accepted but stayed in_progress
60 min (it finished later), so the batch route stays on glm53b. Running total $3.0660 of $30.
Resumed by the operator 07.10 (smoke checked green; no code reviews until further notice). Next, in order: **P12** primer (issue #1,
label `P12-primer`) → **smoke stop** (V2 primer on this repo); P13a, P13b, P14 → **final smoke stop**. At each smoke stop:
🧪, then stop; the operator resumes.
Lessons for the next preparations: default code targets add a test file (give a smoke cap or code-only targets); new
files need `"intent": "generate"` in the map; a new `src/` folder needs its layer in `decks/tools/guard.mjs`; size a judge
from its expected answer (≥ 28 000 for a ~20 KB answer, before the ×3); vary every constant the code must not hard-code
across the examples; every mutant run under a 120 s timeout; kill leftover watchers/workers of the scratch tree.

## Machine

- User `morph` (not root: Claude Code refuses to skip permissions under root). Repo
