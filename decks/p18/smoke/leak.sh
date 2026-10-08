#!/usr/bin/env bash
# Issue #9 acceptance, data part: templates/ holds no trace of the repository it was generalised from — no project or
# predecessor names, no phase numbers, no history dates, no home paths. Prints every hit as file:line:text; exit 1 on any.
#   decks/p18/smoke/leak.sh [templates-dir]
set -u
DIR="${1:-templates}"
[ -d "$DIR" ] || { echo "leak: no directory $DIR"; exit 2; }
PAT='MorphV2|morph-?v2|mrph|morph-lab|MorphProject|VasyaLutiy|/home/|\bjohn\b|\bP[0-9]{1,2}[a-z]?[0-9]?\b|(^|[^0-9.])[0-3][0-9]\.(0[1-9]|1[0-2])([^0-9.]|$)|glm|deepseek|\bds\b|v2bin'
HITS="$(grep -rnIiP "$PAT" "$DIR" || true)"
if [ -n "$HITS" ]; then printf '%s\n' "$HITS"; echo "leak: $(printf '%s\n' "$HITS" | wc -l) line(s) in $DIR"; exit 1; fi
echo "leak: 0 lines in $(find "$DIR" -type f | wc -l) files of $DIR"
