#!/bin/bash
cd /tmp/claude-0/work
for chunk in "sophia:A1 sophia:A2 sophia:A3 sophia:A4" "sophia:A5 eric:A1 eric:A2 eric:A3" "eric:A4 eric:A5"; do
  for rb in $chunk; do ./opt.sh ${rb%%:*} ${rb##*:} & done; wait
done
# regenerate the winners, compress, measure
rm -f res/f_done.flag
./finalrun2.sh
echo ALLDONE > res/all_done.flag
