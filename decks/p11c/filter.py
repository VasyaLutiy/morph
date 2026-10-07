#!/usr/bin/env python3
"""P11c1: `morph plan --component runloop --component acceptance --component cli --component git --component cards` cuts
every Function of the five Components; keep the twelve cards of this phase, in the cut's order, and rewrite the deck file
in place in the form `morph plan --out` writes (JSON, indent 2, newline). A dependency outside the phase is already on
main and is dropped. Data only (docs/TASK_P11c_runner.md §8)."""
import json
import sys

PHASE = ["run-deck", "run-command", "commit-card", "run-acceptance", "card-model", "build-attempt-diff",
         "run-deck-judge", "run-command-judge", "commit-card-judge", "run-acceptance-judge", "card-model-judge",
         "build-attempt-diff-judge"]


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
