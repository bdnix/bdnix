import sys, numpy as np
sys.path.insert(0, 'tools')
def read_hdr(p):
    f = open(p, 'rb')
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
    e = img[..., 3].astype(np.int32)
    return img[..., :3].astype(np.float32) * np.ldexp(1.0, e - 136)[..., None] * (e > 0)[..., None]
def rle(row):
    out = bytearray(); i = 0; n = len(row)
    while i < n:
        j = i
        while j < n and j - i < 127 and row[j] == row[i]: j += 1
        if j - i >= 4: out += bytes([128 + j - i, row[i]]); i = j; continue
        k = i
        while k < n and k - i < 128:
            if k + 3 < n and row[k] == row[k+1] == row[k+2] == row[k+3]: break
            k += 1
        out += bytes([k - i]) + bytes(row[i:k]); i = k
    return out
def write_hdr(p, img):
    h, w, _ = img.shape
    m = img.max(axis=2); e = np.zeros((h, w), np.int32); mant = np.zeros((h, w), np.float32)
    nz = m > 1e-32
    mant[nz], e[nz] = np.frexp(m[nz])
    rgbe = np.zeros((h, w, 4), np.uint8)
    sc = np.where(nz, mant * 256.0 / np.where(nz, m, 1), 0)
    rgbe[..., :3] = np.clip(img * sc[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(nz, e + 128, 0).astype(np.uint8)
    o = open(p, 'wb'); o.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % (h, w))
    for y in range(h):
        o.write(bytes([2, 2, w >> 8, w & 255]))
        for c in range(4): o.write(rle(rgbe[y, :, c].tobytes()))
for name in sys.argv[1:]:
    a = read_hdr('ph/' + name + '.hdr'); h, w, _ = a.shape
    f = w // 1024
    b = a[:h // f * f, :w // f * f].reshape(h // f, f, w // f, f, 3).mean(axis=(1, 3))
    write_hdr('ship/sky/' + name.replace('_puresky_2k', '') + '.hdr', b)
