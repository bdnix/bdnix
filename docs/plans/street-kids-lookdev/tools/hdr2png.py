import sys, numpy as np
from PIL import Image, ImageDraw
def read_hdr(p):
    f = open(p, 'rb'); 
    while f.readline().strip(): pass
    dims = f.readline().split(); h, w = int(dims[1]), int(dims[3])
    data = np.frombuffer(f.read(), np.uint8); img = np.zeros((h, w, 4), np.uint8); pos = 0
    for y in range(h):
        pos += 4
        for c in range(4):
            x = 0
            while x < w:
                n = int(data[pos]); pos += 1
                if n > 128: n -= 128; img[y, x:x+n, c] = data[pos]; pos += 1
                else: img[y, x:x+n, c] = data[pos:pos+n]; pos += n
                x += n
    e = img[..., 3].astype(np.float32)
    return img[..., :3] * (np.ldexp(1.0, (e - 136).astype(int)))[..., None] * (e > 0)[..., None]
out = sys.argv[1]; files = sys.argv[2:]
sheet = Image.new('RGB', (1024, 280 * len(files)))
for i, p in enumerate(files):
    hdr = read_hdr(p); m = hdr / (1 + hdr); m = (np.clip(m * 1.6, 0, 1) ** (1/2.2) * 255).astype(np.uint8)
    im = Image.fromarray(m).resize((1024, 256)); sheet.paste(im, (0, i * 280))
    ImageDraw.Draw(sheet).text((4, i*280 + 260), p.split('/')[-1], fill='white')
sheet.save(out)
