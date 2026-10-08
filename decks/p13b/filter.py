#!/usr/bin/env python3
"""P13b: `morph plan --component scout-session --component cli` cuts every Function of the two Components; keep the nine
cards of this phase (Run Scout, Scout Command, Plan From Scout, Parse Command and their judges, Main's judge), in the
cut's order, and rewrite the deck file in place in the form `morph plan --out` writes (JSON, indent 2, newline). A
dependency outside the phase is already on main and is dropped. Main's code card is not in the phase: parse-command writes
src/cli/main.ts (the routing must land with the widened Command type, or tsc breaks main.ts), and main-judge depends on
parse-command in the map. Data only (docs/TASK_P13b_scout.md §8)."""
import json
import sys

PHASE = ["run-scout", "scout-command", "plan-from-scout", "parse-command", "run-scout-judge", "scout-command-judge",
         "plan-from-scout-judge", "parse-command-judge", "main-judge"]


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
