# MorphV2 on another project (operator 10.10)

The order of work is the skill `morph-v2-orchestrator` (`.claude/skills/morph-v2-orchestrator/`,
reached from any project through `~/.claude/skills/morph-v2-orchestrator`); the phase's data and the
exit codes are `docs/ORCHESTRATOR_REFERENCE.md`. This file has the binary, the wrapper, what to change
in an mrph project's data, and the task header. It was checked dry (no paid call) on a scratch clone
of ETHSmartChecker (Python, an mrph project with 27 runs) on 10.10.

## 1. The binary

```bash
cd /home/john/Documents/Work2026/MorphV2 && npm run build      # dist/ at the commit you want
mkdir -p /tmp/morphbin && cp -r dist package.json /tmp/morphbin/ && ln -sfn $PWD/node_modules /tmp/morphbin/node_modules
```
Run the COPY (`/tmp/morphbin/dist/cli.js`), never the repo's `dist/` (a rebuild in the middle
would replace the running binary).

### The processor env: wrapper `~/bin/morphv2`
V2 does not read `.env` from the current directory. It reads `MORPH_PROCESSOR_<P>_<KEY>` from its environment.
The wrapper maps them from morph-lab's `.env` by indirection and never prints the key:
```bash
#!/bin/bash
(
  set -a; . /home/john/Documents/Work2026/MorphProject/morph-lab/.env; set +a
  for P in ds glm; do for k in TYPE API_KEY MODEL ROUTE CONCURRENCY PROVIDER_ORDER REASONING_MAX_TOKENS; do
    v="MRPH_PROCESSOR_${P}_$k"; [ -n "${!v:-}" ] && export "MORPH_PROCESSOR_${P}_$k=${!v}"
  done; done
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  exec node /tmp/morphbin/dist/cli.js "$@"
)
```
A Claude Code session needs the permission `Bash(~/bin/morphv2:*)`, or the auto-mode classifier
denies scout and run ("Create Unsafe Agents").

## 2. The project's data: what V2 requires that mrph did not
Found on ETHSmartChecker. The record and the map were otherwise read as they are, and plan, deck check and primer gave exit 0:
1. **Every Function needs `behavior:`.** mrph accepted `steps` alone; V2 refuses the record
   with `System.groups[i].functions[j].behavior: required` (3 Functions in ethsc).
2. **The language goes into `morph-map.json`: `"language": "python"`** (or `language:` on the
   Component). Without it a Python card ends with the TypeScript finale ("TypeScript with
   `strict` on … vitest").
3. **The Python finale is fixed:** "Python 3.10 or later … pytest … `tests/conftest.py`". On a
   project with other conventions (ethsc: Python 3.9 syntax, `tests/helpers.py`) the card
   gets two contradicting lines. The finale comes last, after the map's instruction. This is
   a V2 finding, not fixed here: it goes to a Fable review, as all bugs do.

## 3. The task header

The header gives the goal, the constraints and the processor; the order of work is the skill.
```
/morph-v2-orchestrator

Project: the current folder. Phase: <p>.
Morph CLI: ~/bin/morphv2 (binary copy at MorphV2 <commit>). Processor: ds (maxTokens x3 after the cut) or glm.
Constraints: <budget, what not to touch, merge: mine / fast-forward allowed>.

<the phase text: goal, items, the live smoke it must pass>
```
Untested so far: a paid V2 run and a V2 scout on a Python project. The first phase is that test.
