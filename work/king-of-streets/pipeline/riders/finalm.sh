#!/bin/bash
cd /tmp/claude-0/work
one(){ B=$1; cfg=$(cat res3/best_$B.cfg)
  case $B in A1|A4) SQ="SQ1=0.040 SQ2=0.120";; *) SQ="SQ1=0.030 SQ2=0.100";; esac
  env $cfg RB=0.7 $SQ TAG=_f ./batchm.sh $B >/dev/null 2>&1
}
for B in "$@"; do one $B & done; wait
