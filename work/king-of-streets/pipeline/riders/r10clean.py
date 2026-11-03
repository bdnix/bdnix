import numpy as np,cv2,shutil,os
src='/tmp/claude-0/work/src/x/helm_r10'
def make(dst,hue_deg=None):
    shutil.rmtree(dst,ignore_errors=True);shutil.copytree(src,dst)
    p=f'{dst}/textures/Main_baseColor.png'
    im=cv2.imread(p,cv2.IMREAD_UNCHANGED);alpha=None
    if im.shape[2]==4:alpha=im[...,3];im=im[...,:3].copy()
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    white=(hsv[...,2]>200)&(hsv[...,1]<70)          # the white lettering and star outlines
    mask=cv2.dilate(white.astype(np.uint8)*255,np.ones((15,15),np.uint8))
    out=cv2.inpaint(im,mask,12,cv2.INPAINT_TELEA)
    if hue_deg is not None:
        h2=cv2.cvtColor(out,cv2.COLOR_BGR2HSV).astype(np.float32)
        m=(h2[...,1]>60)&(h2[...,2]>40)
        h2[...,0][m]=(h2[...,0][m]+hue_deg/2)%180
        out=cv2.cvtColor(h2.astype(np.uint8),cv2.COLOR_HSV2BGR)
    if alpha is not None:out=np.dstack([out,alpha])
    cv2.imwrite(p,out)
    print(dst,'painted out',int((mask>0).sum()),'pixels of lettering and logos')
make('/tmp/claude-0/work/src/x/helm_r10_m')            # the man's: blue
make('/tmp/claude-0/work/src/x/helm_r10_w',hue_deg=160) # the woman's: blue turned red

def ghosts(dst):
    p=f'{dst}/textures/Main_baseColor.png'
    im=cv2.imread(p,cv2.IMREAD_UNCHANGED);alpha=None
    if im.shape[2]==4:alpha=im[...,3];im=im[...,:3].copy()
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    dark=(hsv[...,2]<90)
    mask=np.zeros(dark.shape,np.uint8)
    for x0,y0,x1,y1 in [(150,20,300,470),(1520,1520,1960,1760)]:   # where the maker's name was written (2048 px texture)
        mask[y0:y1,x0:x1]=dark[y0:y1,x0:x1]
    mask=cv2.dilate(mask*255,np.ones((9,9),np.uint8))
    out=cv2.inpaint(im,mask,12,cv2.INPAINT_TELEA)
    if alpha is not None:out=np.dstack([out,alpha])
    cv2.imwrite(p,out);print(dst,'ghost pixels',int((mask>0).sum()))
ghosts('/tmp/claude-0/work/src/x/helm_r10_m');ghosts('/tmp/claude-0/work/src/x/helm_r10_w')

def label(dst):
    p=f'{dst}/textures/Main_baseColor.png'
    im=cv2.imread(p,cv2.IMREAD_UNCHANGED);alpha=None
    if im.shape[2]==4:alpha=im[...,3];im=im[...,:3].copy()
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    light=(hsv[...,2]>70)&(hsv[...,1]<80)
    mask=np.zeros(light.shape,np.uint8)
    x0,y0,x1,y1=1400,90,1760,420         # the printed model and maker name
    mask[y0:y1,x0:x1]=light[y0:y1,x0:x1]
    mask=cv2.dilate(mask*255,np.ones((7,7),np.uint8))
    out=cv2.inpaint(im,mask,8,cv2.INPAINT_TELEA)
    if alpha is not None:out=np.dstack([out,alpha])
    cv2.imwrite(p,out);print(dst,'label pixels',int((mask>0).sum()))
label('/tmp/claude-0/work/src/x/helm_r10_m');label('/tmp/claude-0/work/src/x/helm_r10_w')

def stars(dst):
    p=f'{dst}/textures/Main_baseColor.png'
    im=cv2.imread(p,cv2.IMREAD_UNCHANGED);alpha=None
    if im.shape[2]==4:alpha=im[...,3];im=im[...,:3].copy()
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
    dark=(hsv[...,2]<110)
    mask=np.zeros(dark.shape,np.uint8)
    # where the star marks were (texture px, 2048): small boxes round each
    for cx,cy,r in [(1150,580,70),(330,860,150),(990,950,70),(1160,1760,160),(1760,1340,70),(560,560,50)]:
        mask[cy-r:cy+r,cx-r:cx+r]=dark[cy-r:cy+r,cx-r:cx+r]
    # keep the big designed dark panels: only small dark blobs count
    n,lab,st,_=cv2.connectedComponentsWithStats(mask.astype(np.uint8),8)
    keep=np.zeros_like(mask)
    for i in range(1,n):
        if st[i,cv2.CC_STAT_AREA]<6000:keep[lab==i]=1
    keep=cv2.dilate(keep*255,np.ones((7,7),np.uint8))
    out=cv2.inpaint(im,keep,10,cv2.INPAINT_TELEA)
    if alpha is not None:out=np.dstack([out,alpha])
    cv2.imwrite(p,out);print(dst,'star blot pixels',int((keep>0).sum()))
stars('/tmp/claude-0/work/src/x/helm_r10_m');stars('/tmp/claude-0/work/src/x/helm_r10_w')
# dark visor: the Glass material becomes dark, opaque and glossy
import json
for d in ('/tmp/claude-0/work/src/x/helm_r10_m','/tmp/claude-0/work/src/x/helm_r10_w'):
    g=json.load(open(d+'/scene.gltf'))
    for m in g['materials']:
        if m['name']=='Glass':
            m['pbrMetallicRoughness']={'baseColorFactor':[0.015,0.017,0.02,1.0],'metallicFactor':0.6,'roughnessFactor':0.08}
            m.pop('alphaMode',None);m.pop('extensions',None)
    json.dump(g,open(d+'/scene.gltf','w'))
print('visor darkened')
