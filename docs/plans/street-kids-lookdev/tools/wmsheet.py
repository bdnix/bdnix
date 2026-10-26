import json, sys, subprocess, time, os, io
sys.path.insert(0, os.path.dirname(__file__))
from wm import api, UA
from PIL import Image, ImageDraw
out, titles = sys.argv[1], sys.argv[2:]
d = api({'action': 'query', 'titles': '|'.join(titles), 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 480})
pages = list(d['query']['pages'].values())
W, H = 480, 320
sheet = Image.new('RGB', (W * 4, (H + 24) * ((len(pages) + 3) // 4)), 'white')
meta = {}
for i, p in enumerate(pages):
    ii = p['imageinfo'][0]; m = ii.get('extmetadata', {})
    meta[p['title']] = {'url': ii['url'], 'w': ii['width'], 'h': ii['height'], 'lic': m.get('LicenseShortName', {}).get('value'), 'artist': m.get('Artist', {}).get('value', '')}
    r = subprocess.run(['curl', '-sS', '-A', UA['User-Agent'], ii['thumburl']], capture_output=True)
    time.sleep(1)
    try: im = Image.open(io.BytesIO(r.stdout)).convert('RGB'); im.thumbnail((W, H))
    except Exception: continue
    x, y = (i % 4) * W, (i // 4) * (H + 24)
    sheet.paste(im, (x, y)); ImageDraw.Draw(sheet).text((x + 4, y + H + 6), f"{i} {p['title'][5:60]} | {meta[p['title']]['lic']}", fill='black')
    meta[p['title']]['i'] = i
sheet.save(out)
json.dump(meta, open(out + '.json', 'w'), ensure_ascii=False, indent=1)
