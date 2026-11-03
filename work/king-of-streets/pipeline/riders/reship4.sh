#!/bin/bash
cd /tmp/claude-0/work
one(){ B=$1
  node optr2.mjs res3/w_${B}_f_rider.glb res3/w_${B}_ship.glb 2048 70 512 > res3/v_$B.txt 2>&1
  node plainone.mjs res3/w_${B}_ship.glb res3/w_${B}_shipplain.glb
  /tmp/claude-0/venv/bin/python merge.py bikes_plain/$B.glb res3/w_${B}_shipplain.glb res3/w_${B}_shipcheck.glb >/dev/null 2>&1
  F=res3/w_${B}_shipcheck.glb; export BIKE=$B
  { /tmp/claude-0/venv/bin/python measure.py $F 2>&1 | grep -E "penetration|more than|closest hand"
    /tmp/claude-0/venv/bin/python gaps2.py $F 2>&1 | grep -E "hand:"
    /tmp/claude-0/venv/bin/python seatgap.py $F 2>&1 | grep -E "closest"
    /tmp/claude-0/venv/bin/python inside.py $F 2>&1 | grep -v INFO | head -3
    /tmp/claude-0/venv/bin/python air.py $F 2>&1 | grep AIR; } >> res3/v_$B.txt
  python3 mkimgs3.py w $B x >/dev/null
  node cut.mjs res3/cut_$B /work/king-of-streets/models/bikes/$B.glb /files/res3/w_${B}_ship.glb res/vc_$B.json >/dev/null 2>&1; cp res3/cut_$B/cut.jpg res3/img_$B/cut.jpg
  node views3.mjs res3/img_$B /work/king-of-streets/models/bikes/$B.glb /files/res3/w_${B}_ship.glb res/vx_$B.json >/dev/null 2>&1
}
for B in A1 A2 A3 A4 A5; do one $B & done; wait
node optr2.mjs res3/stand_w_rider.glb res3/stand_w_ship.glb 2048 70 512 > /dev/null 2>&1
node views3.mjs res3/s_w - /files/res3/stand_w_ship.glb res/vs2.json >/dev/null 2>&1
for h in m w; do node optr2.mjs res3/helmet_${h}_full_raw.glb res3/helmet_$h.glb 2048 70 512 >/dev/null 2>&1 || true; done
