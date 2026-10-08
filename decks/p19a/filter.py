#!/usr/bin/env python3
"""P19a: `morph plan --component contour --component language --component planner` cuts every Function of the three
Components; keep the eight cards of this phase (Validate Record, Dependency Finale, Cut Component, Plan Spec and their
judges; issue #10), in the cut's order, and rewrite the deck file in place in the form `morph plan --out` writes (JSON,
indent 2, newline). A dependency outside the phase is already on main and is dropped. Data only
(docs/TASK_P19a_deps.md §8)."""
import json
import sys

PHASE = ["validate-record", "dependency-finale", "cut-component", "plan-spec",
         "validate-record-judge", "dependency-finale-judge", "cut-component-judge", "plan-spec-judge"]


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
