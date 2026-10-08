#!/usr/bin/env python3
"""P14a: `morph plan --component reviewer` cuts every Function of the Component; P14a's record holds exactly its five
pure Functions, so the cut is the phase's ten cards (Find Obligations, Check Envelope, Check Guardrails, Plan Mutants,
Render Findings and their judges). The filter asserts that, keeps the cut's order, drops any dependency outside the phase
(none expected) and rewrites the deck file in place in the form `morph plan --out` writes (JSON, indent 2, newline).
Data only (docs/TASK_P14_reviewer.md §8)."""
import json
import sys

CODE = ["find-obligations", "check-envelope", "check-guardrails", "plan-mutants", "render-findings"]
PHASE = CODE + [c + "-judge" for c in CODE]


def main(path):
    with open(path, encoding="utf-8") as fh:
        cards = json.load(fh)
    kept = [c for c in cards if c["customId"] in PHASE]
    assert sorted(c["customId"] for c in kept) == sorted(PHASE), [c["customId"] for c in kept]
    for c in kept:
        if "dependsOn" in c:
            c["dependsOn"] = [d for d in c["dependsOn"] if d in PHASE]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(kept, indent=2, ensure_ascii=False) + "\n")
    print(f"{path}: kept {len(kept)} of {len(cards)} cards")


if __name__ == "__main__":
    main(sys.argv[1])
