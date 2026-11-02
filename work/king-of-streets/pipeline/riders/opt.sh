#!/bin/bash
# usage: opt.sh RIDER BIKE  -> tries variants, writes res/<R>_<B>_best.txt with the winning settings
cd /tmp/claude-0/work
R=$1;B=$2
# base settings come from batch.sh defaults; variants change KN, KNEEOUT, PEGDX
case $B in A1) KB=0.022;KO=1.0;; A2) KB=0.020;KO=1.0;; A3) KB=0.020;KO=0.4;; A4) KB=0.026;KO=0.3;; A5) KB=0.020;KO=0.3;; esac
best=1e9;bestcfg=""
i=0
for dk in 0 0.004; do for ko in 0.4 1 2.5; do for pd in 0 0.025; do
  i=$((i+1))
  K=$(python3 -c "print(round($KB+$dk,4))");KOV=$(python3 -c "print(round($KO*$ko,3))")
  KN=$K KNEEOUT=$KOV PEGDX=$pd TAG=_v$i NOVIEWS=1 ./batch.sh $R $B >/dev/null 2>&1
  sc=$(python3 score.py res/${R}_${B}_v$i.txt | sed -E "s/^[^ ]+ \(([0-9.e+-]+),.*/\1/")
  echo "$R $B v$i KN=$K KNEEOUT=$KOV PEGDX=$pd score=$sc" >> res/opt_${R}_${B}.log
  if python3 -c "import sys;sys.exit(0 if $sc<$best else 1)"; then best=$sc;bestcfg="KN=$K KNEEOUT=$KOV PEGDX=$pd";bi=$i;fi
done;done;done
echo "BEST $R $B v$bi $bestcfg score=$best" >> res/opt_${R}_${B}.log
echo "$bestcfg" > res/best_${R}_${B}.cfg
