#!/bin/bash
# lod.sh <texture size> <name:triangles>... : opt/<n>.glb -> lod/<n>_lo.glb
G=work/node_modules/.bin/gltf-transform
size=$1; shift
for j in "$@"; do n=${j%%:*}; t=${j##*:}
  (cd work && node ../tools/lod.mjs ../opt/$n.glb ../lod/${n}_raw.glb $t) || { echo "FAIL $n"; continue; }
  $G optimize lod/${n}_raw.glb lod/${n}_lo.glb --compress meshopt --flatten false --join false --palette false --instance false --texture-compress webp --texture-size $size --simplify false >/dev/null 2>&1 || echo "FAIL opt $n"
  rm -f lod/${n}_raw.glb; printf "   %-12s %8d bytes\n" $n $(stat -c%s lod/${n}_lo.glb)
done
