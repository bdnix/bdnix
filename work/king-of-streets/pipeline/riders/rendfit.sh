#!/bin/bash
# usage: rendfit.sh glb sheet.jpg
cd /tmp/claude-0/work && node cand.mjs out_f helmet=/files/$1 2>&1 | tail -1 && python3 - "$2" <<'PY'
import sys
from PIL import Image
sh=Image.new('RGB',(4*400,470))
for c,k in enumerate(['front','side','back','q']):
    im=Image.open(f'/tmp/claude-0/work/out_f/helmet_{k}.png').convert('RGB');sh.paste(im.resize((400,467)),(c*400,0))
sh.save(sys.argv[1],quality=85)
PY
