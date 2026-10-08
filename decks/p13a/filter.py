#!/usr/bin/env python3
"""P13a: `morph plan --component scout` cuts every Function of Component scout — in P13a exactly the five of this phase
(Parse Turn, Cage Path, Run Tool, Spend Budget, Seed From Ownership) and their five judges. The filter checks that the cut
holds these ten cards and no other (a Function added to the record before the run would show here), keeps the cut's order
and rewrites the deck file in place in the form `morph plan --out` writes (JSON, indent 2, newline). Data only
(docs/TASK_P13a_scout.md §8)."""
import json
import sys

PHASE = ["parse-turn", "cage-path", "run-tool", "spend-budget", "seed-from-ownership", "parse-turn-judge",
         "cage-path-judge", "run-tool-judge", "spend-budget-judge", "seed-from-ownership-judge"]


def main(path):
    with open(path, encoding="utf-8") as fh:
        cards = json.load(fh)
    kept = [c for c in cards if c["customId"] in PHASE]
    assert sorted(c["customId"] for c in kept) == sorted(PHASE), [c["customId"] for c in kept]
    assert len(kept) == len(cards), [c["customId"] for c in cards if c["customId"] not in PHASE]
    for c in kept:
        if "dependsOn" in c:
            c["dependsOn"] = [d for d in c["dependsOn"] if d in PHASE]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(kept, indent=2, ensure_ascii=False) + "\n")
    print(f"{path}: kept {len(kept)} of {len(cards)} cards")


if __name__ == "__main__":
    main(sys.argv[1])
