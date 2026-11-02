#!/bin/bash
# usage: tune.sh RIDER "RSCALE list" "LEAN list" "SEATZ list" "HS list" "KN list" ; prints one line per combo
cd /tmp/claude-0/work
for RS in $2; do for L in $3; do for Z in $4; do for H in $5; do for K in $6; do
 out=$(RIDER=$1 RSCALE=$RS SEATY=${SEATY:-0.95} SEATZ=$Z LEAN=$L PHI0=0 TAN=${TAN:-0} KN=$K HS=$H /tmp/claude-0/venv/bin/python fit.py A3 t.glb 2>&1)
 reach=$(echo "$out" | grep "limb upperarm" | awk '{print $4}' | tr '\n' '/')
 met=$(echo "$out" | grep METRIC | awk '{print $2":pen"$4"/arc"$6"/gt2:"$8}' | tr '\n' ' ')
 sc=$(/tmp/claude-0/venv/bin/python seatclear.py t.glb 2>&1 | grep -E "depth mm" | awk '{print "seat max "$3"mm"}')
 echo "RS=$RS L=$L Z=$Z HS=$H KN=$K reach=$reach $met $sc"
done;done;done;done;done
