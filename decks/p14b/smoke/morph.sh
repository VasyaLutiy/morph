#!/bin/bash
# Final smoke (after P14b): runs the V2 binary copy /tmp/v2bin-final with processor ds set by indirection from
# morph-lab/.env (MRPH_PROCESSOR_ds_<KEY> -> MORPH_PROCESSOR_ds_<KEY>, only the keys that are set); never printed.
# usage: morph.sh <morph args...>
(
  set -a; . /home/morph/MorphProject/morph-lab/.env; set +a
  for k in TYPE API_KEY MODEL ROUTE CONCURRENCY PROVIDER_ORDER REASONING_MAX_TOKENS; do
    v="MRPH_PROCESSOR_ds_$k"; [ -n "${!v}" ] && export "MORPH_PROCESSOR_ds_$k=${!v}"
  done
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  export GIT_AUTHOR_NAME=Smoke GIT_AUTHOR_EMAIL=smoke@example.invalid GIT_COMMITTER_NAME=Smoke GIT_COMMITTER_EMAIL=smoke@example.invalid
  exec node /tmp/v2bin-final/dist/cli.js "$@"
)
