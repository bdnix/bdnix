#!/bin/bash
cd /tmp/claude-0/work
export FSQ=0.85
one(){ R=$1;B=$2
  cfg=$(cat res/best_${R}_${B}.cfg)
  if [ $R = eric ]; then X="T3F=1.05 RB=0.085"; else X="HELMET=helmet_teal"; fi
  env $cfg $X TAG=_f NOVIEWS=1 ./batch.sh $R $B >/dev/null 2>&1
  OPTQ=80 OPTOTHER=1024 ./verify.sh $R $B _f > res/v_${R}_${B}.txt 2>&1
}
for chunk in "sophia:A1 sophia:A2 sophia:A3 sophia:A4" "sophia:A5 eric:A1 eric:A2 eric:A3" "eric:A4 eric:A5"; do
  for rb in $chunk; do one ${rb%%:*} ${rb##*:} & done; wait
done
echo DONE > res/f_done.flag
