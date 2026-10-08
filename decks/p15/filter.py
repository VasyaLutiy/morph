#!/usr/bin/env python3
"""P15: `morph plan --component language --component builder-go --component builder --component cli --component primer
--component planner` cuts every Function of the six Components; keep the twelve cards of this phase (the go profile, the
Go acceptance builder, the builder's go branch, plan --checks by the Component's profile, the go test count, their
judges and the patch judges of the ripple: profiles, cut-component, plan-spec, build-acceptances), in the cut's order,
and rewrite the deck file in place in the form `morph plan --out` writes (JSON, indent 2, newline). A dependency
outside the phase is already on main and is dropped. Data only (docs/TASK_P15_golang.md §8)."""
import json
import sys

PHASE = ["profiles", "go-acceptance", "build-acceptances", "plan-command", "primer-command", "profiles-judge",
         "go-acceptance-judge", "build-acceptances-judge", "cut-component-judge", "plan-spec-judge", "plan-command-judge",
         "primer-command-judge"]


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
