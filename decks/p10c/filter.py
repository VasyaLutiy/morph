#!/usr/bin/env python3
"""P10c: `morph plan --component compiler --component acceptance --component runloop` cuts every Function of the three
Components (24 cards); keep the eight cards of this phase, in the cut's order, and rewrite the deck file in place in the
form `morph plan --out` writes (JSON, indent 2, newline). A dependency of a kept card must be kept too (all of them
are). Data only (docs/TASK_P10c_runner.md §7)."""
import json
import sys

PHASE = ["compile-card", "verify-card", "process-generation", "run-deck", "compile-card-judge", "verify-card-judge",
         "process-generation-judge", "run-deck-judge"]


def main(path):
    with open(path, encoding="utf-8") as fh:
        cards = json.load(fh)
    kept = [c for c in cards if c["customId"] in PHASE]
    assert sorted(c["customId"] for c in kept) == sorted(PHASE), [c["customId"] for c in kept]
    for c in kept:
        assert all(d in PHASE for d in c.get("dependsOn", [])), (c["customId"], c.get("dependsOn"))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(kept, indent=2, ensure_ascii=False) + "\n")
    print(f"{path}: kept {len(kept)} of {len(cards)} cards")


if __name__ == "__main__":
    main(sys.argv[1])
