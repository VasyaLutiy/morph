#!/bin/bash
# P11b2 smoke: runs the V2 binary with processor dsb (route batch) set by indirection from
# morph-lab/.env; the key is never printed. SLUG / KEYP choose the model and whose key (ds or glm53).
# usage: SLUG=<model> KEYP=<ds|glm53> morph.sh <morph args...>
SLUG=${SLUG:-deepseek/deepseek-v4.1-flash:batch}; KEYP=${KEYP:-ds}
(
  set -a; . /home/morph/MorphProject/morph-lab/.env; set +a
  kv="MRPH_PROCESSOR_${KEYP}_API_KEY"
  export MORPH_PROCESSOR_dsb_TYPE=openrouter
  export MORPH_PROCESSOR_dsb_API_KEY="${!kv}"
  export MORPH_PROCESSOR_dsb_MODEL="$SLUG"
  export MORPH_PROCESSOR_dsb_ROUTE=batch
  export MORPH_PROCESSOR_dsb_REASONING_MAX_TOKENS=1000
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.invalid GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.invalid
  exec node /tmp/v2bin-smoke11b2/dist/cli.js "$@"
)
