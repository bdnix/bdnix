import sys;sys.path.insert(0,'edits')
from common import *
d=prep('a5b')
k=1.024
def R(x0,x1,y0,y1): return (int(x0*k),int(x1*k),int(y0*k),int(y1*k))
p=f'{d}/textures/Material.001_baseColor.png'
a=load(p)
for r in [(140,355,735,955),(872,998,630,800),(958,998,335,625)]:
    a=remove_blobs(a,R(*r),'dark',140,maxarea=20000,dil=3)
a=remove_blobs(a,(938,985,762,822),'dark',140,maxarea=20000,dil=3)
a=remove_blobs(a,(116,152,714,762),'light',70,maxarea=3000,dil=3)
# the white bodywork becomes the H2's black
mx=a.max(2).astype(np.int16); mn=a.min(2).astype(np.int16)
w=((mx>110)&((mx-mn)<45)).astype(np.float32)
w=cv2.GaussianBlur(w,(3,3),0)[...,None]
a=(a*(1-w)+ (a.astype(np.float32)*0.12+10)*w).astype(np.uint8)
save(a,p)
Image.fromarray(a).save('tex_a5b_1.png')
p2=f'{d}/textures/Material.002_baseColor.png'
b=load(p2)
Image.fromarray(b).save('tex_a5b_2_orig.png')
# lettering is also in the clearcoat mask: fill the marks inside the white panels
pc=f'{d}/textures/Material.001_clearcoat.png'
c=load(pc)
white=(c.min(2)>200).astype(np.uint8)*255
inv=255-white
ff=inv.copy(); h,w=ff.shape
mask=np.zeros((h+2,w+2),np.uint8)
cv2.floodFill(ff,mask,(0,0),0)          # what the flood reaches is outside the panels
holes=(ff>0)
c[holes]=255
# strip along the edge that the flood can't separate
c[160:300,488:512]=255
save(c,pc)
Image.fromarray(c).save('tex_a5b_clear.png')
