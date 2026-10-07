#!/usr/bin/env python3
"""P11 fix 1 (FIX[code defect], send-batch): `morph plan --component processor` cuts every Function of the Component;
keep ONLY `send-batch` and empty its dependsOn (assemble-batch and read-batch are merged on main, so the one-card deck
has no edge to resolve). Rewrites the deck file in place in the form `morph plan --out` writes (JSON, indent 2,
newline). Data only (docs/TASK_P11_processor.md §11, "Fix 1 gate")."""
import json
import sys

KEEP = "send-batch"
ON_MAIN = {"assemble-batch", "read-batch"}


def main(path):
    with open(path, encoding="utf-8") as fh:
        cards = json.load(fh)
    kept = [c for c in cards if c["customId"] == KEEP]
    assert len(kept) == 1, [c["customId"] for c in cards]
    assert set(kept[0].get("dependsOn", [])) <= ON_MAIN, kept[0].get("dependsOn")
    kept[0]["dependsOn"] = []
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(kept, indent=2, ensure_ascii=False) + "\n")
    print(f"{path}: kept {len(kept)} of {len(cards)} cards")


if __name__ == "__main__":
    main(sys.argv[1])
