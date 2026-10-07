#!/usr/bin/env python3
"""Old Morph deck -> MorphV2 deck file (the switch test, operator 07.10).

    python3 decks/tools/v2deck.py <in.json> <out.json>

<in.json> is what the old `mrph` produces: the payload of a dry `mrph plan --spec`
(an object with "cards"), or an archived deck `decks/<run-id>.json` (a list). A card is
{custom_id, instruction, meta: {...}} or the flat form with the same keys at the top.
<out.json> is the JSON array `morph run --deck` reads (src/cards/model.ts, camelCase).
Every key is mapped or the script stops: a silently dropped key would change the card.
"""
import json
import sys

# old key -> V2 key; target/targets and reasoning_max_tokens are handled below
SAME = {"custom_id": "customId", "intent": "intent", "context_slice": "contextSlice",
        "instruction": "instruction", "acceptance": "acceptance", "model": "model",
        "max_tokens": "maxTokens", "variants": "variants", "depends_on": "dependsOn"}
SPECIAL = {"target", "targets", "reasoning_max_tokens", "meta"}


def convert(card):
    flat = {k: v for k, v in card.items() if k != "meta"}
    for k, v in (card.get("meta") or {}).items():
        if k in flat and flat[k] != v:
            sys.exit(f"{card.get('custom_id')}: '{k}' differs between card and meta")
        flat[k] = v
    unknown = [k for k in flat if k not in SAME and k not in SPECIAL]
    if unknown:
        sys.exit(f"{flat.get('custom_id')}: no V2 mapping for {unknown}")
    out = {}
    for k, v in flat.items():
        if k in SAME and v is not None:
            out[SAME[k]] = v
    targets = list(flat.get("targets") or [])
    if flat.get("target"):
        if flat["target"] not in targets:
            targets.insert(0, flat["target"])
    if not targets:
        sys.exit(f"{flat.get('custom_id')}: no target")
    out["targets"] = targets
    if flat.get("reasoning_max_tokens"):
        out["reasoning"] = {"maxTokens": flat["reasoning_max_tokens"]}
    order = ["customId", "intent", "targets", "contextSlice", "instruction", "acceptance",
             "model", "maxTokens", "reasoning", "variants", "dependsOn"]
    return {k: out[k] for k in order if k in out}


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    doc = json.load(open(sys.argv[1], encoding="utf-8"))
    cards = doc["cards"] if isinstance(doc, dict) else doc
    deck = [convert(c) for c in cards]
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(deck, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"{len(deck)} cards -> {sys.argv[2]}")


if __name__ == "__main__":
    main()
