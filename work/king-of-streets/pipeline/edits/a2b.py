import sys;sys.path.insert(0,'edits')
from common import *
d=prep('a2b')
p=f'{d}/textures/FairingGasTank_baseColor.png'
a=load(p)
a=inpaint_text(a,(1290,1345,235,650))
a=fill_rect(a,(1297,1334,262,632),(113,113,115))
a=fill_rect(a,(1300,1334,872,1236),(113,113,115),seed=2)
a=inpaint_text(a,(1290,1345,845,1255),dark=30)
save(a,p)
Image.fromarray(a).crop((1230,180,1390,700)).resize((320,1040)).save('crop1e.png')
Image.fromarray(a).crop((1230,780,1390,1400)).resize((320,1240)).save('crop2e.png')
# embossed HONDA on the engine cover (normal map): clone a clean patch from just above
pn=f'{d}/textures/Engine_normal.png'
n=load(pn)
h=44; src=n[1668:1668+h,1262:1442].copy(); dst=n[1716:1716+h,1262:1442]
w=np.ones((h,180,1),np.float32)
w[:8]=np.linspace(0,1,8)[:,None,None]; w[-8:]=np.linspace(1,0,8)[:,None,None]
n[1716:1716+h,1262:1442]=(src*w+dst*(1-w)).astype(np.uint8)
save(n,pn)
# the swingarm and frame are steel with full metal, so they mirror the pale sky and read as white bars: take most of the metal out
for nm,metal,rough in [('ScratchedSteel',0.18,0.6),('Chrome',0.35,0.45)]:
    pm=f'{d}/textures/{nm}_metallicRoughness.png'
    if os.path.exists(pm):
        t=load(pm).astype(np.float32)
        t[...,2]*=metal                       # blue = metallic
        t[...,1]=np.maximum(t[...,1],rough*255)   # green = roughness
        save(np.clip(t,0,255).astype(np.uint8),pm)
