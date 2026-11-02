#!/bin/bash
cd /tmp/claude-0/work
f=$1; export BIKE=${BIKE:-A3}
export BIKE
echo "--- hands on grips"; /tmp/claude-0/venv/bin/python measure.py $f 2>&1 | grep -E "==|penetration|more than"
/tmp/claude-0/venv/bin/python gaps.py $f 2>&1 | grep -E "top to front"
echo "--- seat"; /tmp/claude-0/venv/bin/python seatclear.py $f 2>&1 | grep -E "depth mm|below"
echo "--- feet"; /tmp/claude-0/venv/bin/python pegclear.py $f 2>&1 | grep -E "foot|min vertical"
