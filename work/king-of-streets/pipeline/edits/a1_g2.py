import sys;sys.path.insert(0,'edits')
from common import *
d=prep('g2')
def fillbg(a,rect,ring=24):
    x0,x1,y0,y1=rect
    top=a[max(0,y0-ring):y0-4,x0:x1].reshape(-1,3); bot=a[y1+4:y1+ring,x0:x1].reshape(-1,3)
    bg=np.median(np.concatenate([top,bot]),axis=0)
    rng=np.random.default_rng(7); a[y0:y1,x0:x1]=np.clip(bg+rng.integers(-2,3,size=(y1-y0,x1-x0,1)),0,255).astype(np.uint8); return a
p=f'{d}/textures/Main_baseColor.png'; a=load(p)
a=fillbg(a,(2500,2870,170,380))     # "Vespa 125" script
bm=np.zeros(a.shape[:2],np.uint8); bm[0:100,2335:2445]=255
a=cv2.inpaint(a,bm,9,cv2.INPAINT_TELEA)   # Piaggio badge
# plate lettering: dark marks on a pale plate
x0,x1,y0,y1=0,360,2100,2300
sub=a[y0:y1,x0:x1].astype(np.int16); dark=(sub.max(2)<110).astype(np.uint8)*255
dark=cv2.dilate(dark,np.ones((9,9),np.uint8)); full=np.zeros(a.shape[:2],np.uint8); full[y0:y1,x0:x1]=dark
a=cv2.inpaint(a,full,6,cv2.INPAINT_TELEA)
save(a,p)
Image.fromarray(a).crop((2294,0,2294+600,420)).save('g2_chk_logo.png'); Image.fromarray(a).crop((0,2050,420,2330)).save('g2_chk_plate.png')
# normal map: flatten under the same areas
pn=f'{d}/textures/Main_normal.png'; n=load(pn)
for r in [(2500,2870,170,380),(2330,2440,0,95),(0,360,2100,2300)]:
    x0,x1,y0,y1=r; n[y0:y1,x0:x1]=np.array([128,128,255],np.uint8)
save(n,pn)
pm=f'{d}/textures/Main_metallicRoughness.png'; m=load(pm)
for r in [(2500,2870,170,380),(2330,2440,0,100)]:
    x0,x1,y0,y1=r; ring=np.concatenate([m[max(0,y0-24):y0,x0:x1].reshape(-1,3),m[y1:y1+24,x0:x1].reshape(-1,3)]) if y0>24 else m[y1:y1+40,x0:x1].reshape(-1,3)
    m[y0:y1,x0:x1]=np.median(ring,axis=0).astype(np.uint8)
save(m,pm)
# tyre sidewall text: smooth the sidewall bands (colour and bump), leave the tread alone
k=4.096
for nm in ['baseColor','normal']:
    pw=f'{d}/textures/Wheel_{nm}.png'; w=load(pw)
    for (xa,xb) in [(0,48),(104,214),(268,320)]:
        x0,x1,y0,y1=int(xa*k),int(xb*k),0,int(790*k)
        sub=w[y0:y1,x0:x1].copy()
        w[y0:y1,x0:x1]=cv2.medianBlur(cv2.medianBlur(sub,45),45)
    save(w,pw)
    if nm=='baseColor': Image.fromarray(w).crop((0,0,1400,1500)).resize((700,750)).save('g2_chk_tyre.png')
