import numpy as np,os,shutil,cv2
src='/tmp/claude-0/work/src/x/helmet_motor';dst='/tmp/claude-0/work/src/x/helmet_teal'
shutil.rmtree(dst,ignore_errors=True);shutil.copytree(src,dst)
def shift(name,deg):
    p=f'{dst}/textures/{name}'
    im=cv2.imread(p,cv2.IMREAD_UNCHANGED)
    alpha=None
    if im.shape[2]==4:alpha=im[...,3];im=im[...,:3]
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV).astype(np.float32)
    sat=hsv[...,1]/255.0
    # only the coloured accents (red): leave black/grey alone
    mask=(sat>0.35)&(hsv[...,2]>40)
    h=hsv[...,0]
    h[mask]=(h[mask]+deg/2.0)%180
    out=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2BGR)
    if alpha is not None:out=np.dstack([out,alpha])
    cv2.imwrite(p,out)
    print(name,'recoloured pixels',int(mask.sum()),'of',mask.size)
shift('Material_01_baseColor.png',-180+30)    # red -> teal
shift('Material_01_emissive.png',-180+30)
