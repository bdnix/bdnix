import sys;sys.path.insert(0,'edits')
from common import *
d=prep('a3')
p=f'{d}/textures/plastico_0_baseColor.jpeg'
a=load(p)
white=((a.min(2)>=228)).astype(np.uint8)*255   # the "pulsar" script is pure white
m=cv2.dilate(white,np.ones((9,9),np.uint8))
for (x0,x1,y0,y1) in [(1690,1995,460,745),(1240,1545,1160,1440)]:   # hexagon logos: orange outlines
    sub=a[y0:y1,x0:x1].astype(np.int16)
    org=((sub[...,0]>200)&(sub[...,1]>90)&(sub[...,1]<190)&(sub[...,2]<90)).astype(np.uint8)*255
    org=cv2.dilate(org,np.ones((9,9),np.uint8))
    m[y0:y1,x0:x1]=np.maximum(m[y0:y1,x0:x1],org)
a=cv2.inpaint(a,m,5,cv2.INPAINT_TELEA)
for r in [(135,205,1150,1280),(1785,1880,1448,1552)]: a=clean_rect(a,r,thr=30)
save(a,p)
Image.fromarray(a).resize((1000,1000)).save('tex_a3_e.png')
print('masked px',int((m>0).sum()))

# the script is also embossed in the normal map: flatten it where the white mask was
pn=f'{d}/textures/plastico_0_normal.png'
if os.path.exists(pn):
    n=load(pn)
    mm=cv2.dilate(m,np.ones((15,15),np.uint8))>0
    flat=np.array([128,128,255],np.uint8)
    n[mm]=flat
    save(n,pn)
