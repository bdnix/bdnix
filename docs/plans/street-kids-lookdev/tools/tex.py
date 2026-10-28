import sys
from PIL import Image
src, dst = 'ph/', 'ship/textures/'
sets = {'asphalt_02': (1024, ['diff','nor_gl','rough']), 'concrete_pavement': (1024, ['diff','nor_gl','rough']),
  'plastered_wall_04': (512, ['diff','nor_gl']), 'worn_plaster_wall': (512, ['diff']),
  'white_plaster_02': (512, ['diff','nor_gl','rough']), 'concrete_wall_006': (512, ['diff','nor_gl','rough']),
  'concrete_tiles': (512, ['diff','nor_gl','rough'])}
for n, (s, fs) in sets.items():
  for f in fs:
    im = Image.open(src + n + '_' + f + '.jpg').convert('RGB').resize((s, s), Image.LANCZOS)
    im.save(dst + n + '_' + f + '.webp', quality=80 if f == 'diff' else 85, method=6)
