import sys;sys.path.insert(0,'edits')
from common import *
d=prep('a4')
p=f'{d}/textures/Material_4_baseColor.png'
a=load(p)
def poly_dark(a,pts,thr=105,dil=3):
    m=np.zeros(a.shape[:2],np.uint8); cv2.fillPoly(m,[np.array(pts,np.int32)],255)
    dark=(a.max(2)<thr).astype(np.uint8)*255
    t=cv2.dilate(cv2.bitwise_and(m,dark),np.ones((dil*2+1,dil*2+1),np.uint8))
    return cv2.inpaint(a,t,5,cv2.INPAINT_TELEA)
a=poly_dark(a,[(752,494),(872,468),(880,496),(764,526),(752,524)])
a=poly_dark(a,[(752,560),(795,558),(878,588),(878,614),(795,598),(752,588)])
for r in [(275,355,740,795),(660,740,740,795)]: a=remove_blobs(a,r,'light',55,dil=3)     # GSX-R decals
a=remove_blobs(a,(200,255,792,840),'light',55,dil=3,maxarea=6000)                  # "S" emblem
a=remove_blobs(a,(3,48,785,826),'light',55,dil=3,maxarea=6000)                     # SUZUKI label
a=remove_blobs(a,(478,534,894,913),'light',55,dil=2)                               # small SUZUKI
a=remove_blobs(a,(922,950,140,166),'light',55,dil=2)                               # emblem on the clamp
a=clean_rect(a,(2,94,976,1020),thr=1000)                                           # plate lettering
a=fill_rect(a,(4,92,978,1018),(14,14,14),noise=2)
save(a,p)
Image.fromarray(a).save('tex_a4_e.png')
