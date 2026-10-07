#!/bin/bash
# P11b2 smoke, process B: morph collect --batch <id> every 60 s while exit 1, at most 60 tries.
# usage: collect-loop.sh <batchId> <tag>   -> $S/<tag>-collect.json (last), <tag>-collect.log, <tag>.done
S=/tmp/smoke11b2; id=$1; tag=$2
rm -f $S/$tag.done; : > $S/$tag-collect.log
for i in $(seq 1 60); do
  $S/morph.sh collect --root $S/repo --batch "$id" > $S/$tag-collect.json 2> $S/$tag-collect.err
  rc=$?
  out=$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('outcome'),d.get('status'),d.get('cost'),len(d.get('files') or []))" $S/$tag-collect.json 2>/dev/null)
  echo "try=$i at=$(date +%s) exit=$rc outcome/status/cost/files=$out" >> $S/$tag-collect.log
  [ $rc -ne 1 ] && break
  [ $i -lt 60 ] && sleep 60
done
echo "exit=$rc tries=$i" > $S/$tag.done
