#!/bin/bash
# P15 smoke: V2 binary copy /tmp/v2bin-smoke-go with processor ds by indirection from morph-lab/.env; never printed.
(
  set -a; . /home/morph/MorphProject/morph-lab/.env; set +a
  for k in TYPE API_KEY MODEL ROUTE CONCURRENCY PROVIDER_ORDER REASONING_MAX_TOKENS; do
    v="MRPH_PROCESSOR_ds_$k"; [ -n "${!v}" ] && export "MORPH_PROCESSOR_ds_$k=${!v}"
  done
  for v in $(compgen -e | grep -E '^(MRPH_|JEV_)'); do unset "$v"; done
  exec node /tmp/v2bin-smoke-go/dist/cli.js "$@"
)
