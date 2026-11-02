#!/bin/bash
# usage: verify.sh RIDER BIKE   : takes res/<R>_<B>_rider.glb, compresses it, decompresses it, puts it back on the frozen bike's plain copy, runs every check
cd /tmp/claude-0/work
R=$1;B=$2;T=$3;N=${R}_${B}${T};I=res/${N}_rider.glb
node opt.mjs $I res/${N}_ship.glb 2048 ${OPTQ:-82} ${OPTOTHER} 2>&1 | tail -1
node plainone.mjs res/${N}_ship.glb res/${N}_shipplain.glb
/tmp/claude-0/venv/bin/python merge.py bikes_plain/$B.glb res/${N}_shipplain.glb res/${N}_shipcheck.glb 2>&1 | grep -E "rror|Trace"
echo "--- compressed-file checks: $R on $B"
BIKE=$B ./checkall.sh res/${N}_shipcheck.glb 2>&1 | grep -E "penetration|more than 2|top to front|below the|min vertical"
BIKE=$B /tmp/claude-0/venv/bin/python inside.py res/${N}_shipcheck.glb 2>&1 | grep -v INFO | head -2
