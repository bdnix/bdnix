#!/bin/bash
# usage: batch.sh RIDER(sophia|eric) BIKE   -> res/<rider>_<bike>.glb/.txt/.jpg
cd /tmp/claude-0/work
R=$1;B=$2
case $R in
 sophia) export RIDER=sophia_edit RSCALE=0.0104 HAIRISLAND=17 ;;
 eric)   export RIDER=eric RSCALE=0.0095 HAIRISLAND= ;;
esac
export HDZ=${HDZ:--0.06} HEADUP=${HEADUP:-26} PHI0=0
case $B in
 A1) : ${LEAN:=44} ${SEATZ:=-0.19} ${SEATY:=0.945} ${KN:=0.022} ${TAN:=15} ${HS:=1.2} ${KNEEOUT:=1.0} ;;
 A2) : ${LEAN:=28} ${SEATZ:=-0.30} ${SEATY:=0.935} ${KN:=0.020} ${TAN:=0} ${HS:=1.1} ${KNEEOUT:=1.0} ;;
 A3) : ${LEAN:=38} ${SEATZ:=-0.26} ${SEATY:=0.98} ${KN:=0.020} ${TAN:=0} ${HS:=1.1} ${KNEEOUT:=0.4} ;;
 A4) : ${LEAN:=50} ${SEATZ:=-0.32} ${SEATY:=0.925} ${KN:=0.026} ${TAN:=0} ${HS:=1.1} ${KNEEOUT:=0.3} ;;
 A5) : ${LEAN:=54} ${SEATZ:=-0.30} ${SEATY:=0.94} ${KN:=0.020} ${TAN:=0} ${HS:=1.1} ${KNEEOUT:=0.3} ;;
esac
export LEAN SEATZ SEATY KN TAN HS KNEEOUT PEGDX BIKE=$B
O=res/${R}_${B}${TAG}
/tmp/claude-0/venv/bin/python fit.py $B $O.glb 2>&1 | grep -E "limb upperarm|^foot|removed|helmet tris|rror|Trace" | cut -c1-140 > $O.txt
echo "settings LEAN=$LEAN SEATZ=$SEATZ SEATY=$SEATY KN=$KN TAN=$TAN HS=$HS KNEEOUT=$KNEEOUT" >> $O.txt
/tmp/claude-0/venv/bin/python measure.py $O.glb 2>&1 | grep -E "penetration|more than" >> $O.txt
/tmp/claude-0/venv/bin/python gaps.py $O.glb 2>&1 | grep -E "top to front" >> $O.txt
/tmp/claude-0/venv/bin/python seatclear.py $O.glb 2>&1 | grep -E "depth mm|below the" >> $O.txt
/tmp/claude-0/venv/bin/python pegclear.py $O.glb 2>&1 | grep -E "min vertical" >> $O.txt
/tmp/claude-0/venv/bin/python inside.py $O.glb 2>&1 | grep -v INFO | head -3 >> $O.txt
[ -n "$NOVIEWS" ] || node views.mjs res/v_${R}_${B} /files/$O.glb "3.2,0.95,0.05,0,0.95,0.05,26" "2.0,1.5,2.4,0,0.9,0.05,26" "0.0,1.5,-3.4,0,0.9,0.05,26" "-3.2,0.95,0.05,0,0.95,0.05,26" >/dev/null 2>&1
[ -n "$NOVIEWS" ] || python3 - <<PY
from PIL import Image
sh=Image.new('RGB',(1600,400))
for i in range(4):sh.paste(Image.open('/tmp/claude-0/work/res/v_${R}_${B}/v%d.png'%i).convert('RGB').resize((400,400)),(i*400,0))
sh.save('/tmp/claude-0/work/res/${R}_${B}.jpg',quality=88)
PY
echo DONE >> $O.txt
