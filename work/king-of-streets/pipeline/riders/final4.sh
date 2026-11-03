#!/bin/bash
cd /tmp/claude-0/work
one(){ B=$1; cfg=$(cat res3/best_$B.cfg)
  env $cfg RB=0.7 SQ1=0.030 SQ2=0.100 TAG=_f ./batch4.sh $B >/dev/null 2>&1
  
}
for B in "$@"; do one $B & done; wait
