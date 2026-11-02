#!/usr/bin/env python3
"""Fails if an approved (frozen) file has changed. Run from work/king-of-streets before every review.
A frozen file changes only after the owner has seen and approved the change: then update frozen.json in the same commit."""
import hashlib,json,os,sys
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
frozen=json.load(open(os.path.join(root,'freeze','frozen.json')))
bad=0
for k,v in frozen.items():
    p=os.path.join(root,v['file'])
    h=hashlib.sha256(open(p,'rb').read()).hexdigest() if os.path.exists(p) else None
    if h!=v['sha256']:
        bad+=1; print(f"CHANGED {k} {v['file']}: approved {v['approved']} sha256 {v['sha256'][:12]}, now {str(h)[:12]}")
print(f"{len(frozen)-bad} of {len(frozen)} frozen files match")
sys.exit(1 if bad else 0)
