import bpy,numpy as np
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/claude-0/work/src/x/claudia/scene.gltf')
arm=bpy.data.objects['Object_4'];mesh=bpy.data.objects['Object_6'];arm.parent=None;arm.scale=(0.0095,)*3
bpy.context.view_layer.update()
def find(p):
    return [b.name for b in arm.data.bones if b.name.startswith(p)][0]
def H(n):return np.array((arm.matrix_world@arm.data.bones[n].head_local)[:])
vg={g.name:g.index for g in mesh.vertex_groups}
M=mesh.matrix_world
V=[(np.array((M@v.co)[:]),{g.group:g.weight for g in v.groups}) for v in mesh.data.vertices]
for k in ['index','middle','ring','pinky','thumb']:
    ns=[find(f'{k}_0{i}_l_') for i in (1,2,3)]
    for j,n in enumerate(ns[:2]):
        a=H(n);b=H(ns[j+1]);d=b-a;L=np.linalg.norm(d);d/=L
        rs=[]
        for p,w in V:
            if w.get(vg[n],0)>0.9:
                t=(p-a)@d
                if 0<t<L:rs.append(np.linalg.norm(p-a-d*t))
        print(k,j+1,'half-thickness mean/max mm',round(np.mean(rs)*1000,1),round(np.max(rs)*1000,1),'n',len(rs),'len cm',round(L*100,2))
