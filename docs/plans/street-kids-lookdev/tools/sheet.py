import sys, io, urllib.request, json, os
sys.path.insert(0, os.path.dirname(__file__))
from sf import get
from PIL import Image, ImageDraw
uids = sys.argv[2:]; out = sys.argv[1]
W, H = 400, 225
sheet = Image.new('RGB', (W*4, (H+20)*((len(uids)+3)//4)), 'white')
for i, u in enumerate(uids):
    m = get('/models/' + u)
    imgs = sorted(m['thumbnails']['images'], key=lambda x: abs(x['width']-W))
    im = Image.open(io.BytesIO(urllib.request.urlopen(imgs[0]['url']).read())).convert('RGB').resize((W, H))
    x, y = (i%4)*W, (i//4)*(H+20)
    sheet.paste(im, (x, y)); ImageDraw.Draw(sheet).text((x+4, y+H+4), u[:6]+' '+m['name'][:50], fill='black')
sheet.save(out)
