"""Multiply every card's maxTokens in a V2 deck file (operator 07.10: processor ds thinks 15-20k
tokens before the code and no provider honours the reasoning budget, so the cut's budget is x3).
A data step after `morph plan` (and the phase filter), committed with the deck.
Usage: python3 decks/tools/scale_tokens.py <deck.json> [factor=3]"""
import json
import sys

path = sys.argv[1]
factor = int(sys.argv[2]) if len(sys.argv) > 2 else 3
deck = json.load(open(path, encoding="utf-8"))
cards = deck["cards"] if isinstance(deck, dict) else deck
for card in cards:
    if isinstance(card.get("maxTokens"), int):
        card["maxTokens"] *= factor
with open(path, "w", encoding="utf-8") as f:
    f.write(json.dumps(deck, indent=2, ensure_ascii=False) + "\n")
print(f"{len(cards)} cards, maxTokens x{factor}")
