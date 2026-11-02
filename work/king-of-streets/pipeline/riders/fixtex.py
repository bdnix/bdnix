import bpy,numpy as np,cv2,shutil,os
from PIL import Image,ImageDraw
Image.MAX_IMAGE_PIXELS=None
d='sophia'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/src/x/{d}/scene.gltf')
mesh=[o for o in bpy.data.objects if o.type=='MESH' and len(o.vertex_groups)>0][0]
me=mesh.data;uv=me.uv_layers.active.data
lab=np.load(f'/tmp/claude-0/work/uvlab_{d}.npy')
N=2048
tex=np.asarray(Image.open('/tmp/claude-0/work/src/x/sophia/textures/rp_sophia_animated_003_mat_baseColor.jpeg').convert('RGB').resize((N,N),Image.LANCZOS))
mask=Image.new('L',(N,N),0);dr=ImageDraw.Draw(mask)
BLOUSE=[6]   # the blouse pieces that carry hair painted on them
for p in me.polygons:
    if int(lab[p.index]) in BLOUSE:
        pts=[(uv[l].uv[0]*(N-1),(1-uv[l].uv[1])*(N-1)) for l in range(p.loop_start,p.loop_start+p.loop_total)]
        dr.polygon(pts,fill=255)
m=np.array(mask)>0
hsv=cv2.cvtColor(tex,cv2.COLOR_RGB2HSV).astype(float)
V=hsv[...,2]/255;S=hsv[...,1]/255;R=tex[...,0].astype(float);B=tex[...,2].astype(float)
hair=m&(V<0.68)&(R>B*1.30)&(S>0.25)
hair=cv2.dilate(hair.astype(np.uint8),np.ones((15,15),np.uint8))>0
hair&=m
print('blouse-island pixels',int(m.sum()),'hair pixels repainted',int(hair.sum()),'= %.0f%%'%(100*hair.sum()/m.sum()))
white=m&(V>0.86)&(S<0.13)&~hair
wc=np.median(tex[white].reshape(-1,3),axis=0)
print('blouse fabric colour used for the fill',wc.round().astype(int))
out=tex.copy().astype(float)
out[hair]=wc
# keep a little of the fabric's own light/dark variation: add the low-frequency shading of nearby fabric
shade=cv2.GaussianBlur(np.where(white[...,None],tex.astype(float),np.nan).astype(np.float32).copy(),(0,0),1) if False else None
out=cv2.GaussianBlur(out.astype(np.uint8),(0,0),2.5).astype(float)*hair[...,None]+tex.astype(float)*(~hair[...,None])
# feather the edge of the filled area
edge=(cv2.dilate(hair.astype(np.uint8),np.ones((9,9),np.uint8))>0)&~hair
bl=cv2.GaussianBlur(out.astype(np.uint8),(0,0),3).astype(float)
out[edge]=bl[edge]
out=np.clip(out,0,255).astype(np.uint8)
os.makedirs('/tmp/claude-0/work/src/x/sophia_edit/textures',exist_ok=True)
for f in os.listdir('/tmp/claude-0/work/src/x/sophia'):
    if f!='textures':shutil.copy(f'/tmp/claude-0/work/src/x/sophia/{f}','/tmp/claude-0/work/src/x/sophia_edit/'+f)
Image.fromarray(out).save('/tmp/claude-0/work/src/x/sophia_edit/textures/rp_sophia_animated_003_mat_baseColor.jpeg',quality=92)
Image.fromarray(out).save('/tmp/claude-0/work/sophia_tex_fixed.jpg',quality=85)
