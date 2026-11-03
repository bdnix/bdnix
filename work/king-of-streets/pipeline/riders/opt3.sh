#!/bin/bash
cd /tmp/claude-0/work
B=$1
case $B in A1) KB=0.022;KO=-0.2;PD=-0.06;; A2) KB=0.020;KO=0.4;PD=0;; A3) KB=0.020;KO=0.4;PD=0;; A4) KB=0.026;KO=0.3;PD=0;; A5) KB=0.020;KO=0.3;PD=0.045;; esac
best=1e9;i=0
for dk in 0 0.006; do for ko in a b c; do for dp in 0 0.025; do
  i=$((i+1)); K=$(python3 -c "print(round($KB+$dk,4))")
  case $ko in a) KOV=$KO;; b) KOV=$(python3 -c "print(round($KO+0.8,3))");; c) KOV=$(python3 -c "print(round($KO+2.0,3))");; esac
  if [ $B = A1 ]; then KOV=$(python3 -c "print(round($KO-0.2*('$ko'=='b')-0.4*('$ko'=='c'),3))"); fi
  PDV=$(python3 -c "print(round($PD+$dp,3))")
  KN=$K KNEEOUT=$KOV PEGDX=$PDV TAG=_v$i ./batch3.sh $B >/dev/null 2>&1
  sc=$(python3 score.py res3/w_${B}_v$i.txt | sed -E "s/^[^ ]+ \(([0-9.e+-]+),.*/\1/")
  echo "$B v$i KN=$K KNEEOUT=$KOV PEGDX=$PDV score=$sc" >> res3/opt_$B.log
  if python3 -c "import sys;sys.exit(0 if $sc<$best else 1)"; then best=$sc;echo "KN=$K KNEEOUT=$KOV PEGDX=$PDV" > res3/best_$B.cfg;fi
done;done;done
echo "BEST $(cat res3/best_$B.cfg) score=$best" >> res3/opt_$B.log
