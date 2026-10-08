#!/usr/bin/env python3
"""P18: `morph plan --component scaffold --component cli` cuts every Function of the two Components; keep the five cards
of this phase (Init Project, Parse Command and their judges, Main's judge; issue #9), in the cut's order, and rewrite the
deck file in place in the form `morph plan --out` writes (JSON, indent 2, newline). A dependency outside the phase is
already on main and is dropped. Main's code card is not in the phase: parse-command writes src/cli/main.ts (the routing
must land with the widened Command type), the P14b/P17 pattern. Data only (docs/TASK_P18_template.md §8)."""
import json
import sys

PHASE = ["init-project", "parse-command", "init-project-judge", "parse-command-judge", "main-judge"]


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
