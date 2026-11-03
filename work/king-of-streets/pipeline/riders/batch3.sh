#!/bin/bash
# usage: batch3.sh BIKE  (the woman in racing leathers)  -> res3/w_<bike><TAG>.glb/.txt
cd /tmp/claude-0/work; mkdir -p res3
B=$1
export RIDER=${RIDER:-racergirl_boots} RSCALE=0.00902 HAIRISLAND= HELMET=helm_r10_w HROT=0 HFIT=1 HSF=${HSF:-1.0} RB=${RB:-1.0} HEADUP=${HEADUP:-26} PHI0=0 RESKIN=1 FSQ=${FSQ:-0.85}
case $B in
 A1) : ${LEAN:=24} ${SEATZ:=-0.28} ${SEATY:=0.945} ${KN:=0.022} ${TAN:=15} ${HS:=1.0} ${KNEEOUT:=-0.2} ${FOOTP:=0.12} ${PEGDX:=-0.06} ${PEGDZ:=0.10} ;;
 A2) : ${LEAN:=28} ${SEATZ:=-0.30} ${SEATY:=0.935} ${KN:=0.020} ${TAN:=0} ${HS:=1.0} ${KNEEOUT:=0.4} ;;
 A3) : ${LEAN:=38} ${SEATZ:=-0.26} ${SEATY:=0.98} ${KN:=0.020} ${TAN:=0} ${HS:=1.0} ${KNEEOUT:=0.4} ;;
 A4) : ${LEAN:=50} ${SEATZ:=-0.32} ${SEATY:=0.925} ${KN:=0.026} ${TAN:=0} ${HS:=1.0} ${KNEEOUT:=0.3} ;;
 A5) : ${LEAN:=54} ${SEATZ:=-0.30} ${SEATY:=0.94} ${KN:=0.020} ${TAN:=0} ${HS:=1.0} ${KNEEOUT:=0.3} ${PEGDX:=0.045} ;;
esac
export LEAN SEATZ SEATY KN TAN HS KNEEOUT PEGDX PEGDZ FOOTP BIKE=$B
O=res3/w_${B}${TAG}
/tmp/claude-0/venv/bin/python fit3.py $B $O.glb 2>&1 | grep -E "limb upperarm|^foot|SEATFINAL|removed|helmet tris|rror|Trace" | cut -c1-150 > $O.txt
echo "settings LEAN=$LEAN SEATZ=$SEATZ SEATY=$SEATY KN=$KN TAN=$TAN HS=$HS KNEEOUT=$KNEEOUT PEGDX=$PEGDX FOOTP=$FOOTP T3F=$T3F" >> $O.txt
/tmp/claude-0/venv/bin/python measure.py $O.glb 2>&1 | grep -E "penetration|more than|closest hand" >> $O.txt
/tmp/claude-0/venv/bin/python gaps.py $O.glb 2>&1 | grep -E "top to front" >> $O.txt
/tmp/claude-0/venv/bin/python gaps2.py $O.glb 2>&1 | grep -E "hand:" >> $O.txt
/tmp/claude-0/venv/bin/python seatgap.py $O.glb 2>&1 | grep -E "closest" >> $O.txt
/tmp/claude-0/venv/bin/python inside.py $O.glb 2>&1 | grep -v INFO | head -3 >> $O.txt
echo DONE >> $O.txt
