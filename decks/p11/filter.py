#!/usr/bin/env python3
"""P11: `morph plan --component processor` cuts every Function of the Component; keep the eight cards of this phase, in
the cut's order, and rewrite the deck file in place in the form `morph plan --out` writes (JSON, indent 2, newline). A
dependency of a kept card must be kept too (all of them are). Data only (docs/TASK_P11_processor.md §8)."""
import json
import sys

PHASE = ["assemble-batch", "read-batch", "send-batch", "send-generation", "assemble-batch-judge", "read-batch-judge",
         "send-batch-judge", "send-generation-judge"]


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
