#!/usr/bin/env python3
"""P20: `morph plan --component cli --component planner-subset` cuts every Function of the two Components; keep the six
cards of this phase (Parse Command, Select Cards, Plan Command and their judges; issue #11), in the cut's order, and
rewrite the deck file in place in the form `morph plan --out` writes (JSON, indent 2, newline). A dependency outside the
phase is already on main and is dropped. Data only (docs/TASK_P20_rerun.md §8). The last phase cut with a filter:
from P20 on, `morph plan --only` does this."""
import json
import sys

PHASE = ["parse-command", "select-cards", "plan-command",
         "parse-command-judge", "select-cards-judge", "plan-command-judge"]


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
