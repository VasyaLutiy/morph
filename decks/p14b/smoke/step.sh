#!/bin/bash
# step.sh <name> <morph args...>: one step, stdout -> out/<name>.json, stderr -> out/<name>.err, exit+seconds -> out/steps.log, out/<name>.done
N=$1; shift; O=/tmp/smoke-final/out
t0=$(date +%s.%N); /tmp/smoke-final/morph.sh "$@" > $O/$N.json 2> $O/$N.err; rc=$?; t1=$(date +%s.%N)
echo "$N EXIT=$rc SEC=$(echo "$t1-$t0"|bc)" | tee -a $O/steps.log > $O/$N.done
