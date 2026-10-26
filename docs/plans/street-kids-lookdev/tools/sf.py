import json, os, sys, urllib.request, urllib.parse
T = os.environ['SF_TOKEN']
def get(path, auth=True):
    url = path if path.startswith('http') else 'https://sketchfab.com/v3' + path
    r = urllib.request.Request(url, headers={'Authorization': 'Token ' + T} if auth else {})
    return json.load(urllib.request.urlopen(r))
def info(uid):
    m = get('/models/' + uid)
    return '%s | %s | %s | %sk faces | %s | dl=%s anim=%s' % (uid, m['name'][:45], m['user']['username'], m['faceCount']//1000, (m.get('license') or {}).get('label'), m.get('isDownloadable'), m.get('animationCount'))
def search(q, n=12, extra=''):
    d = get('/search?type=models&downloadable=true&count=24&q=' + urllib.parse.quote(q) + extra)
    out = []
    for m in d['results'][:n]:
        out.append('%s | %s | %s | %sk | %s | anim=%s | likes=%s' % (m['uid'], m['name'][:45], m['user']['username'], m['faceCount']//1000, (m.get('license') or {}).get('label'), m.get('animationCount'), m.get('likeCount')))
    return out
if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'info':
        for u in sys.argv[2:]: print(info(u))
    elif cmd == 'search':
        for q in sys.argv[2:]:
            print('==', q)
            for l in search(q, extra='&license=by'): print(' ', l)
            for l in search(q, n=6, extra='&license=cc0'): print('  cc0', l)
