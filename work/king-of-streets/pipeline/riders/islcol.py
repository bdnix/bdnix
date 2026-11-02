import bpy,numpy as np,sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
d='sophia'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/src/x/{d}/scene.gltf')
mesh=[o for o in bpy.data.objects if o.type=='MESH' and len(o.vertex_groups)>0][0]
me=mesh.data;uv=me.uv_layers.active.data
lab=np.load(f'/tmp/claude-0/work/uvlab_{d}.npy')
tex=np.asarray(Image.open('/tmp/claude-0/work/src/x/sophia/textures/rp_sophia_animated_003_mat_baseColor.jpeg').convert('RGB').resize((2048,2048),Image.LANCZOS)).astype(float)
by={}
for p in me.polygons:
    u=np.mean([uv[l].uv for l in range(p.loop_start,p.loop_start+p.loop_total)],axis=0)
    px=int(np.clip(u[0]*2047,0,2047));py=int(np.clip((1-u[1])*2047,0,2047))
    by.setdefault(int(lab[p.index]),[]).append(tex[py,px])
for k,v in sorted(by.items(),key=lambda kv:-len(kv[1])):
    a=np.array(v);m=np.median(a,0)
    if len(a)>40:print('island',k,'faces',len(a),'median rgb',m.round().astype(int),'  share of dark-brown samples (V<0.62, R>B*1.5):',round(float(((a.max(1)/255<0.62)&(a[:,0]>a[:,2]*1.5)).mean()),2))
