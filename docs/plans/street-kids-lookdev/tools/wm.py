import json, sys, urllib.request, urllib.parse, time
UA = {'User-Agent': 'StreetKidsLookdev/0.1 (game art research; https://www.bdnix.com)'}
def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(dict(params, format='json'))
    import subprocess
    for t in range(4):
        r = subprocess.run(['curl', '-sS', '-A', UA['User-Agent'], url], capture_output=True, text=True)
        try: return json.loads(r.stdout)
        except Exception: time.sleep(5 * (t + 1))
    raise RuntimeError('api failed')
def search(q, n=40):
    d = api({'action': 'query', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': n, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 400})
    out = []
    for p in (d.get('query', {}).get('pages', {}) or {}).values():
        ii = p['imageinfo'][0]; m = ii.get('extmetadata', {})
        out.append({'title': p['title'], 'w': ii['width'], 'h': ii['height'], 'url': ii['url'], 'thumb': ii.get('thumburl'), 'lic': m.get('LicenseShortName', {}).get('value'), 'artist': m.get('Artist', {}).get('value', '')[:80]})
    return out
if __name__ == '__main__':
    for q in sys.argv[1:]:
        r = search(q); print('==', q, len(r)); time.sleep(2)
        for x in r: print(' ', x['w'], x['h'], x['lic'], '|', x['title'][5:80])
