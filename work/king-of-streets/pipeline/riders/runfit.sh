#!/bin/bash
# usage: runfit.sh BIKE out.glb   (Sophia + helmet; any variable can be overridden from the caller)
cd /tmp/claude-0/work
export BIKE=$1
export HAIRISLAND=${HAIRISLAND-17} HDZ=${HDZ:--0.06} RIDER=${RIDER:-sophia_edit} RSCALE=${RSCALE:-0.0104} LEAN=${LEAN:-38} HEADUP=${HEADUP:-26} PHI0=${PHI0:-0} TAN=${TAN:-0} KN=${KN:-0.020} HS=${HS:-1.1}
/tmp/claude-0/venv/bin/python fit.py $1 $2 2>&1 | grep -E "peg tops|^foot|limb upperarm|knuckle|METRIC|removed|helmet tris|rror|Trace" | cut -c1-120
