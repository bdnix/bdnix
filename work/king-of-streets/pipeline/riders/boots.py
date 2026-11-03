import numpy as np,cv2,shutil,os
src='/tmp/claude-0/work/src/x/racergirl';dst='/tmp/claude-0/work/src/x/racergirl_boots'
shutil.rmtree(dst,ignore_errors=True);shutil.copytree(src,dst)
p=f'{dst}/textures/mat_racer_girl_baseColor.jpeg'
im=cv2.imread(p);hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV).astype(np.float32)
H=hsv[...,0]*2;S=hsv[...,1]/255;V=hsv[...,2]/255
rect=np.zeros(H.shape,bool);rect[1380:1960,320:1160]=True
shoe=rect&(((H>=12)&(H<=60))|(S<0.25))&(V>0.12)     # beige leather and white laces, not the red suit
shoe=cv2.morphologyEx(shoe.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8)).astype(bool)
g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
dark=np.clip(0.06+0.28*g,0,1)                          # dark leather that keeps the stitching and folds
out=im.astype(np.float32)
for c,t in enumerate((1.0,1.0,1.05)):out[...,c][shoe]=dark[shoe]*255*t
cv2.imwrite(p,np.clip(out,0,255).astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,95])
print('recoloured shoe pixels',int(shoe.sum()))
