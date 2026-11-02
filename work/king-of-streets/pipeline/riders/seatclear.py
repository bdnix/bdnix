import bpy,numpy as np,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
f=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
rider=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('rider')][0]
bike=[o for o in bpy.data.objects if o.type=='MESH' and o is not rider]
vs=[];ps=[]
for o in bike:
    m=o.to_mesh();m.transform(o.matrix_world);off=len(vs);vs+=[v.co.copy() for v in m.vertices];ps+=[tuple(off+i for i in p.vertices) for p in m.polygons]
bvh=BVHTree.FromPolygons(vs,ps)
rm=rider.matrix_world;rows=[]
for v in rider.data.vertices:
    p=rm@v.co   # blender: x, y=-z_gltf, z=y_gltf
    gz=-p.y
    if abs(p.x)<0.14 and -0.50<gz<0.05 and 0.6<p.z<1.1:
        # first surface hit going down from just above the vertex's neighbourhood: use hit from 0.25 m above
        h=bvh.ray_cast(Vector((p.x,p.y,p.z+0.25)),Vector((0,0,-1)),0.6)
        if h[0] is not None:
            rows.append((h[0].z-p.z,p.x,gz,p.z))
rows=np.array(rows)
inside=rows[rows[:,0]>0.0]
print('rider verts over the seat/tank area:',len(rows),' below the surface:',len(inside))
if len(inside):
    print(' depth mm: max %.1f  p95 %.1f  mean %.1f ; more than 10 mm: %d ; more than 20 mm: %d'%(inside[:,0].max()*1000,np.percentile(inside[:,0],95)*1000,inside[:,0].mean()*1000,(inside[:,0]>0.01).sum(),(inside[:,0]>0.02).sum()))
    w=inside[np.argsort(-inside[:,0])[:4]]
    for d,x,z,y in w:print('   worst %.1f mm at x %.3f z %.3f y %.3f'%(d*1000,x,z,y))
# how far is the lowest part of the rider above the seat
low=rows[:,0].min()
print(' lowest-clearance vertex: %.1f mm %s'%(low*1000,'(above)' if low<0 else '(inside)'))
