#!/usr/bin/env python3
"""P17: `morph plan --component debt --component cli` cuts every Function of the two Components; keep the seven cards of
this phase (Card Brief, Accept Card, Parse Command and their judges, Main's judge; issue #8), in the cut's order, and
rewrite the deck file in place in the form `morph plan --out` writes (JSON, indent 2, newline). A dependency outside the
phase is already on main and is dropped. Main's code card is not in the phase: parse-command writes src/cli/main.ts (the
routing must land with the widened Command type), the P14b pattern. Data only (docs/TASK_P17_debt.md §8)."""
import json
import sys

PHASE = ["card-brief", "accept-card", "parse-command", "card-brief-judge", "accept-card-judge", "parse-command-judge",
         "main-judge"]


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
