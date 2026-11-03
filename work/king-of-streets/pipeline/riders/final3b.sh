#!/bin/bash
cd /tmp/claude-0/work
one(){ B=$1; cfg=$(cat res3/best_$B.cfg)
  env $cfg RB=0.7 TAG=_f ./batch3.sh $B >/dev/null 2>&1
  node opt.mjs res3/w_${B}_f_rider.glb res3/w_${B}_ship.glb 2048 70 512 > res3/v_$B.txt 2>&1
  node plainone.mjs res3/w_${B}_ship.glb res3/w_${B}_shipplain.glb
  /tmp/claude-0/venv/bin/python merge.py bikes_plain/$B.glb res3/w_${B}_shipplain.glb res3/w_${B}_shipcheck.glb >/dev/null 2>&1
  F=res3/w_${B}_shipcheck.glb; export BIKE=$B
  { /tmp/claude-0/venv/bin/python measure.py $F 2>&1 | grep -E "penetration|more than|closest hand"
    /tmp/claude-0/venv/bin/python gaps2.py $F 2>&1 | grep -E "hand:"
    /tmp/claude-0/venv/bin/python seatgap.py $F 2>&1 | grep -E "closest"
    /tmp/claude-0/venv/bin/python inside.py $F 2>&1 | grep -v INFO | head -3; } >> res3/v_$B.txt
}
for B in "$@"; do one $B & done; wait
