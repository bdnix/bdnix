# Eric's business clothes recoloured as riding gear: white and grey cloth -> navy leather, skin (hands, neck) -> black gloves, black stays.
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
src='/tmp/claude-0/work/src/x/eric/textures/rp_eric_rigged_001_mat_baseColor.jpeg'
im=np.asarray(Image.open(src).convert('RGB')).astype(np.float32)/255
mx=im.max(2);mn=im.min(2);S=np.where(mx>1e-4,(mx-mn)/np.maximum(mx,1e-4),0);V=mx
r,g,b=im[...,0],im[...,1],im[...,2]
lum=0.299*r+0.587*g+0.114*b
# hue for skin (red/orange/pink): r dominant
skin=(r>g+0.04)&(r>b+0.04)&(S>0.16)&(V>0.28)
light=(~skin)&(V>0.34)&(S<0.22)
def soft(m,rad):
    from scipy.ndimage import gaussian_filter
    return np.clip(gaussian_filter(m.astype(np.float32),rad),0,1)
mL=soft(light,1.2);mS=soft(skin,1.2)
out=im.copy()
# navy leather from the cloth's own shading (keeps the folds)
Ln=np.clip((lum-0.34)/(0.95-0.34),0,1)
navy_dark=np.array([0.012,0.016,0.034]);navy_light=np.array([0.085,0.115,0.210])
navy=navy_dark+(navy_light-navy_dark)*(Ln[...,None]**1.4)
glove_dark=np.array([0.018,0.018,0.022]);glove_light=np.array([0.20,0.20,0.23])
Ls=np.clip((lum-0.2)/(0.85-0.2),0,1)
glove=glove_dark+(glove_light-glove_dark)*(Ls[...,None]**1.5)
out=out*(1-mL[...,None])+navy*mL[...,None]
out=out*(1-mS[...,None])+glove*mS[...,None]
Image.fromarray((np.clip(out,0,1)*255).astype(np.uint8)).save('/tmp/claude-0/work/src/x/eric_gear/textures/rp_eric_rigged_001_mat_baseColor.jpeg',quality=93)
Image.fromarray((np.clip(out,0,1)*255).astype(np.uint8)).resize((1024,1024)).save('/tmp/claude-0/work/eric_gear_small.jpg',quality=88)
print('done',light.mean(),skin.mean())
