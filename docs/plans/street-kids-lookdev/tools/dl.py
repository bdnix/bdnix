import sys, os, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from sf import get
out = sys.argv[1]
for pair in sys.argv[2:]:
    name, uid = pair.split('=')
    p = os.path.join(out, name + '.glb')
    if os.path.exists(p): continue
    try:
        d = get('/models/%s/download' % uid)
        urllib.request.urlretrieve(d['glb']['url'], p)
        print(name, os.path.getsize(p)//1024, 'KB')
    except Exception as e: print(name, 'FAILED', e)
