import os,shutil,numpy as np,cv2
from PIL import Image
def prep(name):
    d=f'build/{name}'
    if os.path.exists(d): shutil.rmtree(d)
    shutil.copytree(f'src/{name}',d); return d
def load(p): return np.array(Image.open(p).convert('RGB'))
def save(a,p): Image.fromarray(a).save(p)
def inpaint_text(a,rect,dark=50,light=135,sat=60,dil=3,rad=7,keep_red=True):
    """Remove lettering: inpaint very dark / very light low-saturation pixels inside rect (x0,x1,y0,y1)."""
    x0,x1,y0,y1=rect
    sub=a[y0:y1,x0:x1].astype(np.int16)
    mx=sub.max(2);mn=sub.min(2);v=mx
    low=(mx-mn)<sat
    m=((v<dark)|(v>light))&low
    m=m.astype(np.uint8)*255
    m=cv2.dilate(m,np.ones((dil*2+1,dil*2+1),np.uint8))
    full=np.zeros(a.shape[:2],np.uint8); full[y0:y1,x0:x1]=m
    return cv2.inpaint(a,full,rad,cv2.INPAINT_TELEA)
def fill_rect(a,rect,color,noise=3,seed=1):
    x0,x1,y0,y1=rect; rng=np.random.default_rng(seed)
    n=rng.integers(-noise,noise+1,size=(y1-y0,x1-x0,1))
    a[y0:y1,x0:x1]=np.clip(np.array(color)+n,0,255).astype(np.uint8); return a
def clean_rect(a,rect,thr=40,dil=2,ring=10):
    """Remove marks inside rect: whatever differs from the median colour of the ring round it becomes that colour."""
    x0,x1,y0,y1=rect
    big=a[max(0,y0-ring):y1+ring,max(0,x0-ring):x1+ring]
    mask=np.ones(big.shape[:2],bool); mask[ring if y0>=ring else y0:-ring, ring if x0>=ring else x0:-ring]=False
    bg=np.median(big[mask],axis=0)
    sub=a[y0:y1,x0:x1].astype(np.int16)
    m=(np.abs(sub-bg).max(2)>thr).astype(np.uint8)
    m=cv2.dilate(m,np.ones((dil*2+1,dil*2+1),np.uint8)).astype(bool)
    sub[m]=bg
    a[y0:y1,x0:x1]=sub.astype(np.uint8); return a
def remove_blobs(a,rect,mode,thr,maxarea=4000,dil=2,rad=5):
    """Inpaint small isolated dark ('dark') or bright ('light') blobs inside rect (x0,x1,y0,y1): lettering and emblems."""
    x0,x1,y0,y1=rect
    v=a[y0:y1,x0:x1].max(2)
    m=((v<thr) if mode=='dark' else (v>thr)).astype(np.uint8)
    n,lab,st,_=cv2.connectedComponentsWithStats(m,connectivity=8)
    keep=np.zeros_like(m)
    h,w=m.shape
    for i in range(1,n):
        x,y,bw,bh,area=st[i]
        if area<=maxarea and x>0 and y>0 and x+bw<w and y+bh<h: keep[lab==i]=255
    keep=cv2.dilate(keep,np.ones((dil*2+1,dil*2+1),np.uint8))
    full=np.zeros(a.shape[:2],np.uint8); full[y0:y1,x0:x1]=keep
    return cv2.inpaint(a,full,rad,cv2.INPAINT_TELEA)
